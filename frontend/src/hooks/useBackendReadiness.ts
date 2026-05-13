import { useEffect, useRef } from 'react';
import { API_BASE_URL } from '../services/api';
import { useBackendStore } from '../store/backendStore';

const POLL_INTERVAL_MS = 4000;
const MAX_TOTAL_WAIT_MS = 120000;
const HEALTH_FETCH_MS = 130000;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export function useBackendReadiness() {
  const warmupAttempt = useBackendStore((s) => s.warmupAttempt);
  const setBackendReady = useBackendStore((s) => s.setBackendReady);
  const setWarmingUp = useBackendStore((s) => s.setWarmingUp);
  const setWarmupTimedOut = useBackendStore((s) => s.setWarmupTimedOut);

  const generationRef = useRef(0);

  useEffect(() => {
    if (!API_BASE_URL) {
      setWarmingUp(false);
      setBackendReady(false);
      setWarmupTimedOut(true);
      return;
    }

    const myGen = ++generationRef.current;
    const stale = () => myGen !== generationRef.current;
    const deadline = Date.now() + MAX_TOTAL_WAIT_MS;

    const run = async () => {
      if (stale()) return;
      setWarmingUp(true);
      setWarmupTimedOut(false);
      setBackendReady(false);

      while (!stale() && Date.now() < deadline) {
        const controller = new AbortController();
        const tid = window.setTimeout(() => controller.abort(), HEALTH_FETCH_MS);
        try {
          const res = await fetch(`${API_BASE_URL}/health_check`, {
            method: 'GET',
            signal: controller.signal,
          });

          if (stale()) return;

          if (res.ok) {
            const data = (await res.json()) as {
              rag_available?: boolean;
              status?: string;
              warmup_status?: string;
            };
            if (stale()) return;

            if (data.rag_available) {
              setBackendReady(true);
              setWarmingUp(false);
              setWarmupTimedOut(false);
              return;
            }
            const ws = data.warmup_status ?? data.status;
            const terminalFail =
              ws === 'failed' || data.status === 'failed' || data.status === 'unavailable';
            if (terminalFail) {
              setBackendReady(false);
              setWarmingUp(false);
              setWarmupTimedOut(true);
              return;
            }
          }
        } catch {
          if (stale()) return;
        } finally {
          window.clearTimeout(tid);
        }

        await sleep(POLL_INTERVAL_MS);
        if (stale()) return;
      }

      if (!stale()) {
        setWarmingUp(false);
        setWarmupTimedOut(true);
      }
    };

    void run();

    return () => {
      generationRef.current++;
    };
  }, [warmupAttempt, setBackendReady, setWarmingUp, setWarmupTimedOut]);
}
