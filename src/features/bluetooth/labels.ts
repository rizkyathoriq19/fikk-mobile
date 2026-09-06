import type { ConnectionSnapshot, DeviceStateSnapshot } from './connection-controller';

export function formatConnectionStatus(snapshot: ConnectionSnapshot): string {
  if (snapshot.adapterState === 'off') {
    return 'Bluetooth is off';
  }
  if (snapshot.adapterState === 'unsupported') {
    return 'Bluetooth is unavailable';
  }
  if (snapshot.adapterState === 'unauthorized') {
    return 'Bluetooth permission is needed';
  }
  if (snapshot.status === 'error') {
    return 'Connection needs attention';
  }
  switch (snapshot.status) {
    case 'requesting-permission':
      return 'Requesting Bluetooth access…';
    case 'scanning':
      return 'Searching for your Fikk device…';
    case 'connecting':
      return 'Connecting…';
    case 'discovering':
      return 'Preparing device…';
    case 'ready':
      return 'Ready to train';
    default:
      return 'Device not ready';
  }
}

export function formatDeviceState(state: DeviceStateSnapshot | null): string {
  if (state === null) {
    return 'No state snapshot';
  }
  return `${['READY', 'ACTIVE', 'COMPLETED', 'ERROR'][state.state] ?? 'UNKNOWN'} · ${state.count} · ${state.elapsedMs} ms`;
}
