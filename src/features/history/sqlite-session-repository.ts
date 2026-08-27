import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import type { TrainingSession, TrainingSessionRepository } from './session-repository';

type SessionRow = {
  id: string;
  ble_session_id: number;
  notes: string | null;
  target_count: number;
  final_count: number;
  duration_ms: number;
  started_at: string;
  completed_at: string;
  device_key: string;
  device_name: string | null;
  status: TrainingSession['status'];
  protocol_version: number;
};

const CREATE_SESSIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS training_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    ble_session_id INTEGER NOT NULL,
    notes TEXT,
    target_count INTEGER NOT NULL,
    final_count INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    device_key TEXT NOT NULL,
    device_name TEXT,
    status TEXT NOT NULL,
    protocol_version INTEGER NOT NULL,
    UNIQUE(device_key, ble_session_id)
  );
  CREATE INDEX IF NOT EXISTS training_sessions_completed_at_idx
    ON training_sessions(completed_at DESC);
`;

export class SQLiteTrainingSessionRepository implements TrainingSessionRepository {
  constructor(private readonly database: SQLiteDatabase) {
    database.execSync(CREATE_SESSIONS_TABLE);
  }

  async upsert(session: TrainingSession): Promise<void> {
    await this.database.runAsync(
      `
        INSERT INTO training_sessions (
          id,
          ble_session_id,
          notes,
          target_count,
          final_count,
          duration_ms,
          started_at,
          completed_at,
          device_key,
          device_name,
          status,
          protocol_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(device_key, ble_session_id) DO UPDATE SET
          id = excluded.id,
          notes = excluded.notes,
          target_count = excluded.target_count,
          final_count = excluded.final_count,
          duration_ms = excluded.duration_ms,
          started_at = excluded.started_at,
          completed_at = excluded.completed_at,
          device_name = excluded.device_name,
          status = excluded.status,
          protocol_version = excluded.protocol_version
      `,
      [
        session.id,
        session.bleSessionId,
        session.notes,
        session.targetCount,
        session.finalCount,
        session.durationMs,
        session.startedAt,
        session.completedAt,
        session.deviceKey,
        session.deviceName,
        session.status,
        session.protocolVersion,
      ],
    );
  }

  async list(): Promise<TrainingSession[]> {
    const rows = await this.database.getAllAsync<SessionRow>(
      'SELECT * FROM training_sessions ORDER BY completed_at DESC, id DESC',
      [],
    );
    return rows.map(toTrainingSession);
  }

  async get(id: string): Promise<TrainingSession | null> {
    const row = await this.database.getFirstAsync<SessionRow>(
      'SELECT * FROM training_sessions WHERE id = ?',
      [id],
    );
    return row === null ? null : toTrainingSession(row);
  }
}

export function createNativeTrainingSessionRepository(): TrainingSessionRepository {
  return new SQLiteTrainingSessionRepository(openDatabaseSync('fikk.db'));
}

function toTrainingSession(row: SessionRow): TrainingSession {
  return {
    id: row.id,
    bleSessionId: row.ble_session_id,
    notes: row.notes,
    targetCount: row.target_count,
    finalCount: row.final_count,
    durationMs: row.duration_ms,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    deviceKey: row.device_key,
    deviceName: row.device_name,
    status: row.status,
    protocolVersion: row.protocol_version,
  };
}
