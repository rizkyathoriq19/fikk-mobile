import type { ConnectionSnapshot, DeviceStateSnapshot } from './connection-controller';

export function formatConnectionStatus(snapshot: ConnectionSnapshot): string {
  if (snapshot.status === 'error') {
    return 'Error';
  }
  if (snapshot.status === 'ready') {
    return 'Ready';
  }
  return snapshot.status.replaceAll('-', ' ');
}

export function formatDeviceState(state: DeviceStateSnapshot | null): string {
  if (state === null) {
    return 'No state snapshot';
  }
  return `${['READY', 'ACTIVE', 'COMPLETED', 'ERROR'][state.state] ?? 'UNKNOWN'} · ${state.count} · ${state.elapsedMs} ms`;
}
