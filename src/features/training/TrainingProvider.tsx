import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useBluetooth } from '../bluetooth/BluetoothProvider';
import {
  TrainingSessionController,
  type TrainingSnapshot,
} from './session-controller';

type TrainingContextValue = {
  snapshot: TrainingSnapshot;
  start(notes: string): Promise<void>;
};

const TrainingContext = createContext<TrainingContextValue | null>(null);

export function TrainingProvider({ children }: PropsWithChildren) {
  const { connection } = useBluetooth();
  const controller = useMemo(() => new TrainingSessionController({ connection }), [connection]);
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
