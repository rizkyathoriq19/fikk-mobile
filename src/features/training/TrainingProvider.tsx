import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useBluetooth } from '../bluetooth/BluetoothProvider';
import { createNativeTrainingSessionRepository } from '../history/sqlite-session-repository';
import type { TrainingSession } from '../history/session-repository';
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
  const controller = useMemo(
    () => new TrainingSessionController({ connection, repository }),
    [connection, repository],
  );
  const [snapshot, setSnapshot] = useState<TrainingSnapshot>(controller.snapshot);

  useEffect(() => {
    const unsubscribe = controller.subscribe(setSnapshot);
    return () => {
      unsubscribe();
      controller.dispose();
    };
  }, [controller]);

  const value = useMemo(
    () => ({
      snapshot,
      start: (notes: string) => controller.start(notes),
      saveResult: () => controller.saveResult(),
      discardResult: () => controller.discardResult(),
      listSessions: () => controller.listSessions(),
      getSession: (id: string) => controller.getSession(id),
    }),
    [controller, snapshot],
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
