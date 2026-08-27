import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistedTrainingSession, TrainingSessionStore } from './session-store';

const CURRENT_SESSION_KEY = 'fikk.training.current-session.v1';

export class AsyncStorageTrainingSessionStore implements TrainingSessionStore {
  async load(): Promise<PersistedTrainingSession | null> {
    const value = await AsyncStorage.getItem(CURRENT_SESSION_KEY);
    if (value === null) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(value);
      if (isPersistedTrainingSession(parsed)) {
        return parsed;
      }
    } catch {
      // Invalid local state is discarded below.
    }

    await this.clear();
    return null;
  }

  async save(session: PersistedTrainingSession): Promise<void> {
    await AsyncStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(session));
  }

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(CURRENT_SESSION_KEY);
  }
}

export function createNativeTrainingSessionStore(): TrainingSessionStore {
  return new AsyncStorageTrainingSessionStore();
}

function isPersistedTrainingSession(value: unknown): value is PersistedTrainingSession {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const session = value as Partial<PersistedTrainingSession>;
  return (
    (session.state === 'starting' ||
      session.state === 'active' ||
      session.state === 'recovering' ||
      session.state === 'completed') &&
    isUint32(session.sessionId) &&
    typeof session.notes === 'string' &&
    typeof session.deviceKey === 'string' &&
    typeof session.deviceName !== 'undefined' &&
    (session.deviceName === null || typeof session.deviceName === 'string') &&
    typeof session.localId === 'string' &&
    (session.startedAt === null || typeof session.startedAt === 'string') &&
    (session.completedAt === null || typeof session.completedAt === 'string') &&
    Number.isInteger(session.targetCount) &&
    Number.isInteger(session.count) &&
    Number.isInteger(session.elapsedMs) &&
    Number.isInteger(session.highestSequence) &&
    session.result !== undefined &&
    (session.result === null || isPersistedResult(session.result))
  );
}

function isPersistedResult(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const result = value as Partial<PersistedTrainingSession['result']>;
  return (
    result !== null &&
    Number.isInteger(result.count) &&
    Number.isInteger(result.durationMs) &&
    Number.isInteger(result.reason) &&
    Number.isInteger(result.sequence)
  );
}

function isUint32(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 0xffffffff;
}
