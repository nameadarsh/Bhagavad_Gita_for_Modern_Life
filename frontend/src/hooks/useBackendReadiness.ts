import { useEffect, useRef } from 'react';
import { API_BASE_URL } from '../services/api';
import { useBackendStore } from '../store/backendStore';

const POLL_INTERVAL_MS = 4000;
const DEFAULT_MAX_WAIT_MS = 300000; // 5 min — deployed cold starts often exceed 2 min
const HEALTH_FETCH_MS = 30000; // per-request timeout; health_check must stay fast

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function parseMaxWaitMs(): number {
  const raw = import.meta.env.VITE_WARMUP_MAX_MS;
  if (!raw) return DEFAULT_MAX_WAIT_MS;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_WAIT_MS;
}

export function useBackendReadiness() {
  const warmupAttempt = useBackendStore((s) => s.warmupAttempt);
  const setBackendReady = useBackendStore((s) => s.setBackendReady);
  const setWarmingUp = useBackendStore((s) => s.setWarmingUp);
  const setWarmupTimedOut = useBackendStore((s) => s.setWarmupTimedOut);
  const setWarmupFailureReason = useBackendStore((s) => s.setWarmupFailureReason);

  const generationRef = useRef(0);

  useEffect(() => {
    if (!API_BASE_URL) {
      setWarmingUp(false);
      setBackendReady(false);
      setWarmupTimedOut(true);
      setWarmupFailureReason('VITE_API_BASE_URL is not set in the frontend build.');
      return;
    }

    const myGen = ++generationRef.current;
    const stale = () => myGen !== generationRef.current;
    const deadline = Date.now() + parseMaxWaitMs();
    let sawSuccessfulResponse = false;
    let networkErrorStreak = 0;

    const run = async () => {
      if (stale()) return;
      setWarmingUp(true);
      setWarmupTimedOut(false);
      setWarmupFailureReason(null);
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

          networkErrorStreak = 0;
          sawSuccessfulResponse = true;

          if (res.ok) {
            const data = (await res.json()) as {
              rag_available?: boolean;
              status?: string;
              warmup_status?: string;
              warmup_error?: string;
            };
            if (stale()) return;

            if (data.rag_available) {
              setBackendReady(true);
              setWarmingUp(false);
              setWarmupTimedOut(false);
              setWarmupFailureReason(null);
              return;
            }
            const ws = data.warmup_status ?? data.status;
            const terminalFail =
              ws === 'failed' || data.status === 'failed' || data.status === 'unavailable';
            if (terminalFail) {
              setBackendReady(false);
              setWarmingUp(false);
              setWarmupTimedOut(true);
              setWarmupFailureReason(
                data.warmup_error ||
                  'The guidance service failed to start. Check backend logs and environment variables.'
              );
              return;
            }
          }
        } catch {
          if (stale()) return;
          networkErrorStreak += 1;
        } finally {
          window.clearTimeout(tid);
        }

        await sleep(POLL_INTERVAL_MS);
        if (stale()) return;
      }

      if (!stale()) {
        setWarmingUp(false);
        setWarmupTimedOut(true);
        if (!sawSuccessfulResponse) {
          setWarmupFailureReason(
            `Cannot reach the API at ${API_BASE_URL}. Verify VITE_API_BASE_URL and that the backend is running.`
          );
        } else {
          setWarmupFailureReason(
            'The guidance service is still starting. This can take several minutes on a cold deploy — try Retry.'
          );
        }
      }
    };

    void run();

    return () => {
      generationRef.current++;
    };
  }, [
    warmupAttempt,
    setBackendReady,
    setWarmingUp,
    setWarmupTimedOut,
    setWarmupFailureReason,
  ]);
}
