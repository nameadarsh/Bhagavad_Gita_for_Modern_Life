import { create } from 'zustand';

interface BackendState {
  isBackendReady: boolean;
  isWarmingUp: boolean;
  warmupTimedOut: boolean;
  warmupAttempt: number;
  warmupFailureReason: string | null;
  setBackendReady: (ready: boolean) => void;
  setWarmingUp: (warming: boolean) => void;
  setWarmupTimedOut: (timedOut: boolean) => void;
  setWarmupFailureReason: (reason: string | null) => void;
  restartWarmup: () => void;
}

export const useBackendStore = create<BackendState>((set) => ({
  isBackendReady: false,
  isWarmingUp: false,
  warmupTimedOut: false,
  warmupAttempt: 0,
  warmupFailureReason: null,
  setBackendReady: (ready) => set({ isBackendReady: ready }),
  setWarmingUp: (warming) => set({ isWarmingUp: warming }),
  setWarmupTimedOut: (timedOut) => set({ warmupTimedOut: timedOut }),
  setWarmupFailureReason: (reason) => set({ warmupFailureReason: reason }),
  restartWarmup: () => set((state) => ({
    isBackendReady: false,
    isWarmingUp: false,
    warmupTimedOut: false,
    warmupFailureReason: null,
    warmupAttempt: state.warmupAttempt + 1,
  })),
}));
