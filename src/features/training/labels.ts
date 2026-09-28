import { COMPLETION_REASONS } from '../../protocol/constants';

export function formatCompletionReason(reason: number): string {
  switch (reason) {
    case COMPLETION_REASONS.TARGET_REACHED:
      return 'Target reached';
    case COMPLETION_REASONS.STOPPED:
      return 'Stopped';
    case COMPLETION_REASONS.DEVICE_ERROR:
      return 'Device error';
    default:
      return `Unknown (${reason})`;
  }
}

export function formatDuration(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.floor(milliseconds / 1_000) % 60;
  const remainder = milliseconds % 1_000;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(remainder).padStart(3, '0')}`;
}

export function formatTrainingError(error: string): string {
  if (error.includes('recovery')) {
    return 'We could not reconnect to the device. Check that it is nearby and try again.';
  }
  if (error.includes('Device error')) {
    return 'The device reported a problem. Reconnect it before starting a new session.';
  }
  if (error.includes('already starting or active')) {
    return 'A training session is already active.';
  }
  return 'The training session could not start. Check the device and try again.';
}
