import { create } from 'zustand';

interface BackendState {
  isBackendReady: boolean;
  isWarmingUp: boolean;
  warmupTimedOut: boolean;
  warmupAttempt: number;
  setBackendReady: (ready: boolean) => void;
  setWarmingUp: (warming: boolean) => void;
  setWarmupTimedOut: (timedOut: boolean) => void;
  restartWarmup: () => void;
}

export const useBackendStore = create<BackendState>((set) => ({
  isBackendReady: false,
  isWarmingUp: false,
  warmupTimedOut: false,
  warmupAttempt: 0,
  setBackendReady: (ready) => set({ isBackendReady: ready }),
  setWarmingUp: (warming) => set({ isWarmingUp: warming }),
  setWarmupTimedOut: (timedOut) => set({ warmupTimedOut: timedOut }),
  restartWarmup: () => set((state) => ({
    isBackendReady: false,
    isWarmingUp: false,
    warmupTimedOut: false,
    warmupAttempt: state.warmupAttempt + 1,
  })),
}));
