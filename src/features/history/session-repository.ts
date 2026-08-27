export type TrainingSessionStatus = 'completed' | 'recovered' | 'cancelled';

export type TrainingSession = {
  id: string;
  bleSessionId: number;
  notes: string | null;
  targetCount: number;
  finalCount: number;
  durationMs: number;
  startedAt: string;
  completedAt: string;
  deviceKey: string;
  deviceName: string | null;
  status: TrainingSessionStatus;
  protocolVersion: number;
};

export interface TrainingSessionRepository {
  upsert(session: TrainingSession): Promise<void>;
  list(): Promise<TrainingSession[]>;
  get(id: string): Promise<TrainingSession | null>;
}
