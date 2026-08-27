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
