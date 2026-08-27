export const BLE_CHANNELS = {
  EVENT: 'EVENT',
  STATE: 'STATE',
} as const;

export type NotificationChannel = (typeof BLE_CHANNELS)[keyof typeof BLE_CHANNELS];
export type ReadChannel = 'STATE' | 'DEVICE_INFO';

export type BleAdapterState = 'unknown' | 'on' | 'off' | 'unauthorized' | 'unsupported';

export type BleDevice = {
  id: string;
  name: string | null;
  rssi: number | null;
  serviceUuids: readonly string[];
};

export type BleScanOptions = {
  serviceUuid: string;
  seconds: number;
  onDevice: (device: BleDevice) => void;
};

export interface BleTransport {
  initialize(): Promise<void>;
  checkState(): Promise<BleAdapterState>;
  scan(options: BleScanOptions): Promise<void>;
  stopScan(): Promise<void>;
  connect(device: BleDevice): Promise<void>;
  discover(): Promise<void>;
  subscribe(channel: NotificationChannel, listener: (value: Uint8Array) => void): Promise<() => void>;
  read(channel: ReadChannel): Promise<Uint8Array>;
  writeControl(value: Uint8Array): Promise<void>;
  disconnect(): Promise<void>;
  onDisconnect(listener: () => void): () => void;
}

type FakeBleTransportOptions = {
  devices?: readonly BleDevice[];
  adapterState?: BleAdapterState;
  readValues?: Partial<Record<ReadChannel, Uint8Array>>;
};

export class FakeBleTransport implements BleTransport {
  public readonly controlWrites: Uint8Array[] = [];

  private readonly devices: readonly BleDevice[];
  private readonly readValues: Partial<Record<ReadChannel, Uint8Array>>;
  private readonly listeners = new Map<NotificationChannel, Set<(value: Uint8Array) => void>>();
  private readonly disconnectListeners = new Set<() => void>();
  private adapterState: BleAdapterState;
  private connectedDevice: BleDevice | null = null;
  private discovered = false;
  private scanning = false;

  constructor(options: FakeBleTransportOptions = {}) {
    this.devices = options.devices ?? [];
    this.readValues = options.readValues ?? {};
    this.adapterState = options.adapterState ?? 'on';
  }

  get isScanning(): boolean {
    return this.scanning;
  }

  get currentDevice(): BleDevice | null {
    return this.connectedDevice;
  }

  async initialize(): Promise<void> {
    if (this.adapterState === 'unknown') {
      this.adapterState = 'on';
    }
  }

  async checkState(): Promise<BleAdapterState> {
    return this.adapterState;
  }

  async scan(options: BleScanOptions): Promise<void> {
    if (this.adapterState !== 'on') {
      throw new Error(`cannot scan while Bluetooth is ${this.adapterState}`);
    }
    if (!Number.isInteger(options.seconds) || options.seconds <= 0) {
      throw new Error('scan duration must be a positive integer');
    }

    this.scanning = true;
    try {
      for (const device of this.devices) {
        if (device.serviceUuids.includes(options.serviceUuid)) {
          options.onDevice({ ...device, serviceUuids: [...device.serviceUuids] });
        }
      }
    } finally {
      this.scanning = false;
    }
  }

  async stopScan(): Promise<void> {
    this.scanning = false;
  }

  async connect(device: BleDevice): Promise<void> {
    if (this.adapterState !== 'on') {
      throw new Error(`cannot connect while Bluetooth is ${this.adapterState}`);
    }
    this.connectedDevice = device;
    this.discovered = false;
  }

  async discover(): Promise<void> {
    this.requireConnection();
    this.discovered = true;
  }

  async subscribe(channel: NotificationChannel, listener: (value: Uint8Array) => void): Promise<() => void> {
    this.requireDiscoveredConnection();
    const listeners = this.listeners.get(channel) ?? new Set<(value: Uint8Array) => void>();
    listeners.add(listener);
    this.listeners.set(channel, listeners);
    return () => listeners.delete(listener);
  }

  async read(channel: ReadChannel): Promise<Uint8Array> {
    this.requireDiscoveredConnection();
    return new Uint8Array(this.readValues[channel] ?? []);
  }

  async writeControl(value: Uint8Array): Promise<void> {
    this.requireDiscoveredConnection();
    this.controlWrites.push(new Uint8Array(value));
  }

  async disconnect(): Promise<void> {
    this.connectedDevice = null;
    this.discovered = false;
  }

  onDisconnect(listener: () => void): () => void {
    this.disconnectListeners.add(listener);
    return () => this.disconnectListeners.delete(listener);
  }

  emitDisconnect(): void {
    this.connectedDevice = null;
    this.discovered = false;
    for (const listener of this.disconnectListeners) {
      listener();
    }
  }

  emit(channel: NotificationChannel, value: Uint8Array): void {
    for (const listener of this.listeners.get(channel) ?? []) {
      listener(new Uint8Array(value));
    }
  }

  private requireConnection(): void {
    if (!this.connectedDevice) {
      throw new Error('a connected device is required');
    }
  }

  private requireDiscoveredConnection(): void {
    if (!this.connectedDevice || !this.discovered) {
      throw new Error('a connected and discovered connection is required');
    }
  }
}
