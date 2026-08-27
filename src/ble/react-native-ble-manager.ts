import type {
  BleManagerDidUpdateValueForCharacteristicEvent,
  Peripheral,
  PeripheralInfo,
} from 'react-native-ble-manager';
import type {
  BleAdapterState,
  BleDevice,
  BleScanOptions,
  BleTransport,
  NotificationChannel,
  ReadChannel,
} from './transport';
import type { BleProfile } from './profile';

export type BleManagerSubscription = {
  remove(): void;
};

export type BleManagerClient = {
  start(options?: { showAlert?: boolean }): Promise<void>;
  checkState(): Promise<string>;
  onDisconnectPeripheral?: (callback: (event: { peripheral: string }) => void) => BleManagerSubscription;
  scan(options?: { serviceUUIDs?: string[]; seconds?: number; allowDuplicates?: boolean }): Promise<void>;
  stopScan(): Promise<void>;
  connect(peripheralId: string): Promise<void>;
  disconnect(peripheralId: string, force?: boolean): Promise<void>;
  retrieveServices(peripheralId: string, serviceUUIDs?: string[]): Promise<PeripheralInfo>;
  startNotification(peripheralId: string, serviceUuid: string, characteristicUuid: string): Promise<void>;
  stopNotification(peripheralId: string, serviceUuid: string, characteristicUuid: string): Promise<void>;
  read(peripheralId: string, serviceUuid: string, characteristicUuid: string): Promise<number[]>;
  write(peripheralId: string, serviceUuid: string, characteristicUuid: string, data: number[]): Promise<void>;
  onDiscoverPeripheral(callback: (peripheral: Peripheral) => void): BleManagerSubscription;
  onDidUpdateValueForCharacteristic(
    callback: (event: BleManagerDidUpdateValueForCharacteristicEvent) => void,
  ): BleManagerSubscription;
};

export class ReactNativeBleManagerTransport implements BleTransport {
  private connectedDevice: BleDevice | null = null;
  private discovered = false;
  private readonly disconnectListeners = new Set<() => void>();

  constructor(
    private readonly client: BleManagerClient,
    private readonly profile: BleProfile,
  ) {
    this.client.onDisconnectPeripheral?.(({ peripheral }) => {
      if (this.connectedDevice?.id !== peripheral) {
        return;
      }
      this.connectedDevice = null;
      this.discovered = false;
      for (const listener of this.disconnectListeners) {
        listener();
      }
    });
  }

  async initialize(): Promise<void> {
    await this.client.start({ showAlert: false });
  }

  async checkState(): Promise<BleAdapterState> {
    const state = await this.client.checkState();
    switch (state) {
      case 'on':
        return 'on';
      case 'off':
        return 'off';
      case 'unauthorized':
        return 'unauthorized';
      case 'unsupported':
        return 'unsupported';
      default:
        return 'unknown';
    }
  }

  async scan(options: BleScanOptions): Promise<void> {
    if (!Number.isInteger(options.seconds) || options.seconds <= 0) {
      throw new Error('scan duration must be a positive integer');
    }

    const seen = new Set<string>();
    const subscription = this.client.onDiscoverPeripheral((peripheral) => {
      if (!this.matchesProfileService(peripheral) || seen.has(peripheral.id)) {
        return;
      }
      seen.add(peripheral.id);
      options.onDevice(this.toBleDevice(peripheral));
    });

    try {
      await this.client.scan({
        serviceUUIDs: [options.serviceUuid],
        seconds: options.seconds,
        allowDuplicates: false,
      });
    } catch (error) {
      await this.client.stopScan();
      throw error;
    } finally {
      subscription.remove();
    }
  }

  async stopScan(): Promise<void> {
    await this.client.stopScan();
  }

  async connect(device: BleDevice): Promise<void> {
    if (this.connectedDevice && this.connectedDevice.id !== device.id) {
      await this.disconnect();
    }
    await this.client.connect(device.id);
    this.connectedDevice = device;
    this.discovered = false;
  }

  async discover(): Promise<void> {
    const peripheralId = this.requireConnection();
    this.discovered = false;
    const info = await this.client.retrieveServices(peripheralId, [this.profile.serviceUuid]);
    const missing = Object.entries(this.profile.characteristics)
      .filter(
        ([, characteristicUuid]) =>
          !info.characteristics?.some(
            (characteristic) =>
              this.sameUuid(characteristic.service, this.profile.serviceUuid) &&
              this.sameUuid(characteristic.characteristic, characteristicUuid),
          ),
      )
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(`required GATT characteristics missing: ${missing.join(', ')}`);
    }
    this.discovered = true;
  }

  async subscribe(channel: NotificationChannel, listener: (value: Uint8Array) => void): Promise<() => void> {
    const peripheralId = this.requireDiscoveredConnection();
    const characteristicUuid = this.profile.characteristics[channel];
    const valueSubscription = this.client.onDidUpdateValueForCharacteristic((event) => {
      if (
        event.peripheral === peripheralId &&
        this.sameUuid(event.service, this.profile.serviceUuid) &&
        this.sameUuid(event.characteristic, characteristicUuid)
      ) {
        listener(Uint8Array.from(event.value));
      }
    });

    try {
      await this.client.startNotification(peripheralId, this.profile.serviceUuid, characteristicUuid);
    } catch (error) {
      valueSubscription.remove();
      throw error;
    }

    return () => {
      valueSubscription.remove();
      void this.client.stopNotification(peripheralId, this.profile.serviceUuid, characteristicUuid);
    };
  }

  async read(channel: ReadChannel): Promise<Uint8Array> {
    const peripheralId = this.requireDiscoveredConnection();
    const value = await this.client.read(
      peripheralId,
      this.profile.serviceUuid,
      this.profile.characteristics[channel],
    );
    return Uint8Array.from(value);
  }

  async writeControl(value: Uint8Array): Promise<void> {
    const peripheralId = this.requireDiscoveredConnection();
    await this.client.write(
      peripheralId,
      this.profile.serviceUuid,
      this.profile.characteristics.CONTROL,
      [...value],
    );
  }

  async disconnect(): Promise<void> {
    if (!this.connectedDevice) {
      return;
    }
    const peripheralId = this.connectedDevice.id;
    await this.client.disconnect(peripheralId);
    this.connectedDevice = null;
    this.discovered = false;
  }

  onDisconnect(listener: () => void): () => void {
    this.disconnectListeners.add(listener);
    return () => this.disconnectListeners.delete(listener);
  }

  private matchesProfileService(peripheral: Peripheral): boolean {
    const advertisedServices = peripheral.advertising?.serviceUUIDs ?? [];
    return (
      advertisedServices.length === 0 ||
      advertisedServices.some((uuid) => this.sameUuid(uuid, this.profile.serviceUuid))
    );
  }

  private toBleDevice(peripheral: Peripheral): BleDevice {
    return {
      id: peripheral.id,
      name: peripheral.name ?? peripheral.advertising?.localName ?? null,
      rssi: peripheral.rssi ?? null,
      serviceUuids: peripheral.advertising?.serviceUUIDs ?? [],
    };
  }

  private sameUuid(left: string, right: string): boolean {
    return left.replaceAll('-', '').toLowerCase() === right.replaceAll('-', '').toLowerCase();
  }

  private requireConnection(): string {
    const peripheralId = this.connectedDevice?.id;
    if (!peripheralId) {
      throw new Error('a connected device is required');
    }
    return peripheralId;
  }

  private requireDiscoveredConnection(): string {
    const peripheralId = this.connectedDevice?.id;
    if (!peripheralId || !this.discovered) {
      throw new Error('a connected and discovered connection is required');
    }
    return peripheralId;
  }
}
