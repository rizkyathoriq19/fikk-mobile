import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useBluetooth } from '../bluetooth/BluetoothProvider';
import { createNativeTrainingSessionRepository } from '../history/sqlite-session-repository';
import type { TrainingSession } from '../history/session-repository';
import { createNativeTrainingSessionStore } from './native-session-store';
import {
  TrainingSessionController,
  type TrainingSnapshot,
} from './session-controller';

type TrainingContextValue = {
  snapshot: TrainingSnapshot;
  start(notes: string): Promise<void>;
  saveResult(): Promise<TrainingSession>;
  discardResult(): Promise<void>;
  listSessions(): Promise<TrainingSession[]>;
  getSession(id: string): Promise<TrainingSession | null>;
};

const TrainingContext = createContext<TrainingContextValue | null>(null);

export function TrainingProvider({ children }: PropsWithChildren) {
  const { connection } = useBluetooth();
  const repository = useMemo(() => createNativeTrainingSessionRepository(), []);
  const sessionStore = useMemo(() => createNativeTrainingSessionStore(), []);
  const controller = useMemo(
    () => new TrainingSessionController({ connection, repository, sessionStore }),
    [connection, repository, sessionStore],
  );
  const [snapshot, setSnapshot] = useState<TrainingSnapshot>(controller.snapshot);

  useEffect(() => {
    const unsubscribe = controller.subscribe(setSnapshot);
    void (async () => {
      await connection.loadLastDevice().catch(() => undefined);
      await controller.restore();
    })().catch(() => undefined);
    return () => {
      unsubscribe();
      controller.dispose();
    };
  }, [connection, controller]);

  const start = useCallback((notes: string) => controller.start(notes), [controller]);
  const saveResult = useCallback(() => controller.saveResult(), [controller]);
  const discardResult = useCallback(() => controller.discardResult(), [controller]);
  const listSessions = useCallback(() => controller.listSessions(), [controller]);
  const getSession = useCallback((id: string) => controller.getSession(id), [controller]);

  const value = useMemo(
    () => ({
      snapshot,
      start,
      saveResult,
      discardResult,
      listSessions,
      getSession,
    }),
    [getSession, listSessions, saveResult, discardResult, start, snapshot],
  );

  return <TrainingContext.Provider value={value}>{children}</TrainingContext.Provider>;
}

export function useTraining(): TrainingContextValue {
  const value = useContext(TrainingContext);
  if (value === null) {
    throw new Error('useTraining must be used inside TrainingProvider');
  }
  return value;
}
