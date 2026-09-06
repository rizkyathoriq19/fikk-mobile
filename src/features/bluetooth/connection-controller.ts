import { decodeMessage, encodeMessage, MESSAGE_TYPES, type DeviceState, type ProtocolMessage } from '../../protocol/codec';
import type { BleProfile } from '../../ble/profile';
import type { BleAdapterState, BleDevice, BleTransport } from '../../ble/transport';

export type BluetoothConnectionStatus =
  | 'disconnected'
  | 'requesting-permission'
  | 'scanning'
  | 'connecting'
  | 'discovering'
  | 'ready'
  | 'error';

export type DeviceStateSnapshot = {
  state: DeviceState;
  count: number;
  elapsedMs: number;
};

export type ConnectionSnapshot = {
  status: BluetoothConnectionStatus;
  adapterState: BleAdapterState;
  devices: readonly BleDevice[];
  connectedDevice: BleDevice | null;
  deviceInfo: string | null;
  deviceState: DeviceStateSnapshot | null;
  lastDeviceId: string | null;
  error: string | null;
};

export interface BluetoothPermissionGateway {
  request(): Promise<void>;
}

export interface DeviceIdentityStore {
  load(): Promise<string | null>;
  save(deviceId: string): Promise<void>;
  loadDevice?(): Promise<BleDevice | null>;
  saveDevice?(device: BleDevice): Promise<void>;
}

export type ProtocolMessageListener = (message: ProtocolMessage) => void;

type BluetoothConnectionControllerOptions = {
  transport: BleTransport;
  permissions: BluetoothPermissionGateway;
  deviceStore: DeviceIdentityStore;
  profile: BleProfile;
  operationTimeoutMs?: number;
};

type SnapshotPatch = Partial<ConnectionSnapshot>;

type SnapshotListener = (snapshot: ConnectionSnapshot) => void;

const initialSnapshot: ConnectionSnapshot = {
  status: 'disconnected',
  adapterState: 'unknown',
  devices: [],
  connectedDevice: null,
  deviceInfo: null,
  deviceState: null,
  lastDeviceId: null,
  error: null,
};

export class BluetoothConnectionController {
  private currentSnapshot: ConnectionSnapshot = initialSnapshot;
  private readonly listeners = new Set<SnapshotListener>();
  private readonly messageListeners = new Set<ProtocolMessageListener>();
  private notificationUnsubscribers: Array<() => void> = [];
  private readonly unsubscribeFromTransportDisconnect: () => void;
  private readonly operationTimeoutMs: number;
  private lastKnownDevice: BleDevice | null = null;
  private initialized = false;

  constructor(private readonly options: BluetoothConnectionControllerOptions) {
    this.operationTimeoutMs = options.operationTimeoutMs ?? 10_000;
    this.unsubscribeFromTransportDisconnect = options.transport.onDisconnect(() => {
      this.handleTransportDisconnect();
    });
  }

  get snapshot(): ConnectionSnapshot {
    return this.currentSnapshot;
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeMessages(listener: ProtocolMessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  read(channel: 'STATE' | 'DEVICE_INFO'): Promise<Uint8Array> {
    return this.options.transport.read(channel);
  }

  writeControl(value: Uint8Array): Promise<void> {
    return this.options.transport.writeControl(value);
  }

  async loadLastDevice(): Promise<void> {
    const lastDeviceId = await this.options.deviceStore.load();
    this.update({ lastDeviceId });
  }

  async scan(): Promise<void> {
    try {
      await this.ensureInitialized();
      this.update({ status: 'scanning', devices: [], error: null });
      await withTimeout(
        this.options.transport.scan({
          serviceUuid: this.options.profile.serviceUuid,
          seconds: 5,
          onDevice: (device) => this.addDevice(device),
        }),
        this.operationTimeoutMs,
        'BLE scan timed out',
      );
      if (this.currentSnapshot.status === 'scanning') {
        this.update(
          this.currentSnapshot.devices.length === 0
            ? { status: 'error', error: 'No compatible BLE device found after the scan' }
            : { status: 'disconnected' },
        );
      }
    } catch (error) {
      this.fail(error);
    }
  }

  async connect(device: BleDevice): Promise<void> {
    const unsubscribers: Array<() => void> = [];
    try {
      await this.ensureInitialized();
      this.update({ status: 'connecting', connectedDevice: null, error: null });
      await withTimeout(this.options.transport.connect(device), this.operationTimeoutMs, 'BLE connection timed out');
      this.update({ status: 'discovering', connectedDevice: device });
      await withTimeout(this.options.transport.discover(), this.operationTimeoutMs, 'GATT discovery timed out');

      unsubscribers.push(
        await withTimeout(
          this.options.transport.subscribe('EVENT', (value) => this.handleNotification(value)),
          this.operationTimeoutMs,
          'EVENT subscription timed out',
        ),
      );
      unsubscribers.push(
        await withTimeout(
          this.options.transport.subscribe('STATE', (value) => this.handleNotification(value)),
          this.operationTimeoutMs,
          'STATE subscription timed out',
        ),
      );

      const [deviceInfoBytes, stateBytes] = await withTimeout(
        Promise.all([
          this.options.transport.read('DEVICE_INFO'),
          this.options.transport.read('STATE'),
        ]),
        this.operationTimeoutMs,
        'Device synchronization timed out',
      );
      const deviceState = this.decodeState(stateBytes);
      const deviceInfo = decodeText(deviceInfoBytes);
      await this.options.deviceStore.save(device.id);
      const saveDevice = this.options.deviceStore.saveDevice;
      if (saveDevice !== undefined) {
        await saveDevice(device).catch(() => undefined);
      }
      this.lastKnownDevice = device;
      this.notificationUnsubscribers = unsubscribers;
      this.update({
        status: 'ready',
        connectedDevice: device,
        deviceInfo,
        deviceState,
        lastDeviceId: device.id,
        error: null,
      });
    } catch (error) {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
      await this.disconnectTransport().catch(() => undefined);
      this.update({ connectedDevice: null, deviceInfo: null, deviceState: null });
      this.fail(error);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.disconnectTransport();
      this.update({
        status: 'disconnected',
        connectedDevice: null,
        deviceInfo: null,
        deviceState: null,
        error: null,
      });
    } catch (error) {
      this.fail(error);
    }
  }

  async reconnectLastDevice(): Promise<void> {
    let device = this.lastKnownDevice ?? this.currentSnapshot.devices.find((item) => item.id === this.currentSnapshot.lastDeviceId);
    if (device === undefined && this.options.deviceStore.loadDevice !== undefined) {
      device = (await this.options.deviceStore.loadDevice().catch(() => null)) ?? undefined;
    }
    if (device === undefined) {
      this.fail(new Error('No last BLE device is available for recovery'));
      return;
    }

    for (const delayMs of [0, 250, 500]) {
      if (delayMs > 0) {
        await delay(delayMs);
      }
      await this.connect(device);
      if (this.currentSnapshot.status === 'ready') {
        return;
      }
    }

    this.fail(new Error('Unable to reconnect to the last BLE device after bounded retries'));
  }

  sync(sessionId: number): Promise<void> {
    if (this.currentSnapshot.status !== 'ready') {
      return Promise.reject(new Error('Bluetooth device is not Ready for sync'));
    }
    return this.options.transport.writeControl(
      encodeMessage({
        version: 1,
        messageType: MESSAGE_TYPES.SYNC,
        sessionId,
        sequence: 0,
        payload: {},
      }),
    );
  }

  dispose(): void {
    this.clearNotificationSubscriptions();
    this.unsubscribeFromTransportDisconnect();
    this.listeners.clear();
    this.messageListeners.clear();
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      if (this.currentSnapshot.adapterState !== 'on') {
        throw new Error(`Bluetooth adapter is ${this.currentSnapshot.adapterState}`);
      }
      return;
    }

    this.update({ status: 'requesting-permission', error: null });
    await this.options.permissions.request();
    await this.options.transport.initialize();
    const adapterState = await this.options.transport.checkState();
    this.update({ adapterState });
    if (adapterState !== 'on') {
      throw new Error(`Bluetooth adapter is ${adapterState}`);
    }
    this.initialized = true;
  }

  private addDevice(device: BleDevice): void {
    const devices = this.currentSnapshot.devices.some((item) => item.id === device.id)
      ? this.currentSnapshot.devices.map((item) => (item.id === device.id ? device : item))
      : [...this.currentSnapshot.devices, device];
    this.update({ devices });
  }

  private handleTransportDisconnect(): void {
    if (this.currentSnapshot.connectedDevice === null) {
      return;
    }
    this.clearNotificationSubscriptions();
    this.update({
      status: 'disconnected',
      connectedDevice: null,
      deviceInfo: null,
      deviceState: null,
      error: 'Device disconnected',
    });
  }

  private handleNotification(value: Uint8Array): void {
    try {
      const message = decodeMessage(value);
      for (const listener of this.messageListeners) {
        listener(message);
      }
      if (message.messageType === MESSAGE_TYPES.STATE) {
        this.update({ deviceState: message.payload });
      } else if (message.messageType === MESSAGE_TYPES.ERROR) {
        this.update({ error: `Device error 0x${message.payload.errorCode.toString(16)}` });
      }
    } catch (error) {
      this.update({ error: `Invalid device notification: ${toErrorMessage(error)}` });
    }
  }

  private decodeState(value: Uint8Array): DeviceStateSnapshot {
    const message = decodeMessage(value);
    if (message.messageType !== MESSAGE_TYPES.STATE) {
      throw new Error('STATE characteristic returned a non-STATE message');
    }
    return message.payload;
  }

  private async disconnectTransport(): Promise<void> {
    this.clearNotificationSubscriptions();
    await this.options.transport.disconnect();
  }

  private clearNotificationSubscriptions(): void {
    for (const unsubscribe of this.notificationUnsubscribers) {
      unsubscribe();
    }
    this.notificationUnsubscribers = [];
  }

  private fail(error: unknown): void {
    this.update({ status: 'error', error: toErrorMessage(error) });
  }

  private update(patch: SnapshotPatch): void {
    this.currentSnapshot = { ...this.currentSnapshot, ...patch };
    for (const listener of this.listeners) {
      listener(this.currentSnapshot);
    }
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([operation, timeout]).finally(() => clearTimeout(timeoutId));
}

function decodeText(value: Uint8Array): string {
  return String.fromCharCode(...value).replace(/\0+$/, '');
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
