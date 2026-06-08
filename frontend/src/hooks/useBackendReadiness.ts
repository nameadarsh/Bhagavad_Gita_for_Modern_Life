import { useEffect, useRef } from 'react';
import {
  buildApiUrl,
  HAS_API_CONFIG,
  HEALTH_CHECK_URL,
  USE_RELATIVE_API,
} from '../services/apiBase';
import { useBackendStore } from '../store/backendStore';

const POLL_INTERVAL_MS = 4000;
const DEFAULT_MAX_WAIT_MS = 360000;
const COLD_WAKE_FETCH_MS = 120000;
const HEALTH_FETCH_MS = 45000;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function parseMaxWaitMs(): number {
  const raw = import.meta.env.VITE_WARMUP_MAX_MS;
  if (!raw) return DEFAULT_MAX_WAIT_MS;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_WAIT_MS;
}

async function fetchHealthCheck(
  url: string,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const tid = window.setTimeout(() => controller.abort(), timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    return await fetch(url, {
      method: 'GET',
      mode: USE_RELATIVE_API ? 'same-origin' : 'cors',
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(tid);
  }
}

export function useBackendReadiness() {
  const warmupAttempt = useBackendStore((s) => s.warmupAttempt);
  const setBackendReady = useBackendStore((s) => s.setBackendReady);
  const setWarmingUp = useBackendStore((s) => s.setWarmingUp);
  const setWarmupTimedOut = useBackendStore((s) => s.setWarmupTimedOut);
  const setWarmupFailureReason = useBackendStore((s) => s.setWarmupFailureReason);

  const runIdRef = useRef(0);

  useEffect(() => {
    if (!HAS_API_CONFIG) {
      setWarmingUp(false);
      setBackendReady(false);
      setWarmupTimedOut(true);
      setWarmupFailureReason(
        'API is not configured. Set VITE_API_BASE_URL for dev or deploy with vercel.json proxy.'
      );
      return;
    }

    const runId = ++runIdRef.current;
    const isActive = () => runIdRef.current === runId;
    const abort = new AbortController();
    const deadline = Date.now() + parseMaxWaitMs();
    let sawHttpResponse = false;

    const healthUrl = buildApiUrl('/health_check');
    console.info('[readiness] starting poll', {
      attempt: warmupAttempt,
      healthUrl,
      HEALTH_CHECK_URL,
      USE_RELATIVE_API,
      mode: USE_RELATIVE_API ? 'same-origin' : 'cors',
    });

    const run = async () => {
      if (!isActive()) return;
      setWarmingUp(true);
      setWarmupTimedOut(false);
      setWarmupFailureReason(null);
      setBackendReady(false);

      while (isActive() && Date.now() < deadline) {
        const timeoutMs = sawHttpResponse ? HEALTH_FETCH_MS : COLD_WAKE_FETCH_MS;

        try {
          console.info('[readiness] fetch →', healthUrl, { timeoutMs });
          const res = await fetchHealthCheck(healthUrl, timeoutMs, abort.signal);

          if (!isActive()) return;

          sawHttpResponse = true;
          const bodyText = await res.text();
          console.info('[readiness] response', {
            url: healthUrl,
            status: res.status,
            ok: res.ok,
            body: bodyText.slice(0, 500),
          });

          if (!res.ok) {
            await sleep(POLL_INTERVAL_MS);
            continue;
          }

          let data: {
            rag_available?: boolean;
            status?: string;
            warmup_status?: string;
            warmup_error?: string;
          };
          try {
            data = JSON.parse(bodyText) as typeof data;
          } catch (parseErr) {
            console.error('[readiness] JSON parse failed — likely HTML, not API JSON', {
              url: healthUrl,
              bodyPreview: bodyText.slice(0, 120),
              parseErr,
            });
            setWarmupFailureReason(
              USE_RELATIVE_API
                ? 'Health check returned HTML instead of JSON. vercel.json rewrites may be missing — set Vercel Root Directory to frontend/ and redeploy.'
                : 'Health check returned non-JSON. Check VITE_API_BASE_URL points to the FastAPI backend, not the Vercel site.'
            );
            await sleep(POLL_INTERVAL_MS);
            continue;
          }

          if (data.rag_available) {
            console.info('[readiness] backend ready', data);
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
        } catch (err) {
          if (!isActive()) return;
          const isAbort = err instanceof Error && err.name === 'AbortError';
          console.error('[readiness] fetch error', {
            url: healthUrl,
            isAbort,
            error: err,
          });
          if (isAbort && abort.signal.aborted) {
            return;
          }
        }

        await sleep(POLL_INTERVAL_MS);
        if (!isActive()) return;
      }

      if (!isActive()) return;
      setWarmingUp(false);
      setWarmupTimedOut(true);
      if (!sawHttpResponse) {
        setWarmupFailureReason(
          USE_RELATIVE_API
            ? `Cannot reach ${healthUrl}. Ensure vercel.json is deployed (Vercel Root Directory = frontend) and Render backend is up.`
            : `Cannot reach ${healthUrl}. Verify VITE_API_BASE_URL and redeploy the frontend after env changes.`
        );
      } else {
        setWarmupFailureReason('The guidance service is still starting. Try Retry in a moment.');
      }
    };

    void run();

    return () => {
      abort.abort();
      runIdRef.current += 1;
    };
  }, [warmupAttempt, setBackendReady, setWarmingUp, setWarmupTimedOut, setWarmupFailureReason]);
}
