export type PersistedTrainingResult = {
  count: number;
  durationMs: number;
  reason: number;
  sequence: number;
};

export type PersistedTrainingSessionState = 'starting' | 'active' | 'recovering' | 'completed';

export type PersistedTrainingSession = {
  state: PersistedTrainingSessionState;
  sessionId: number;
  notes: string;
  deviceKey: string;
  deviceName: string | null;
  localId: string;
  startedAt: string | null;
  completedAt: string | null;
  targetCount: number;
  count: number;
  elapsedMs: number;
  result: PersistedTrainingResult | null;
  highestSequence: number;
};

export interface TrainingSessionStore {
  load(): Promise<PersistedTrainingSession | null>;
  save(session: PersistedTrainingSession): Promise<void>;
  clear(): Promise<void>;
}
