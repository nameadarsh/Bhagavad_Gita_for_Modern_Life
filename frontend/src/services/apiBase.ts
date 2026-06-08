/**
 * Resolves how the frontend talks to the backend.
 *
 * Production (Vercel): defaults to same-origin `/health_check` via vercel.json rewrites.
 * Set VITE_API_DIRECT=true on Vercel only if you intentionally skip the proxy.
 *
 * Development: set VITE_API_BASE_URL=http://localhost:8000 (vite.config.ts proxies /health_check).
 */
function sanitizeBaseUrl(raw: string | undefined): string {
  if (!raw) return '';
  let value = raw.trim().replace(/^['"]|['"]$/g, '');
  if (!value || value === 'relative' || value === 'same-origin' || value === '/') {
    return '';
  }
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const apiDirect = import.meta.env.VITE_API_DIRECT === 'true';

/** Parsed direct backend origin (empty if unset). */
export const API_BASE_URL = sanitizeBaseUrl(rawBaseUrl);

/**
 * Production defaults to same-origin proxy (vercel.json) to avoid cross-origin failures.
 * Cross-origin direct mode only when VITE_API_DIRECT=true AND VITE_API_BASE_URL is set.
 */
export const USE_RELATIVE_API = import.meta.env.PROD
  ? !(apiDirect && API_BASE_URL.length > 0)
  : API_BASE_URL.length === 0;

export const HAS_API_CONFIG =
  USE_RELATIVE_API && import.meta.env.PROD
    ? true
    : API_BASE_URL.length > 0;

export const API_URL = USE_RELATIVE_API ? '/api/v1' : `${API_BASE_URL}/api/v1`;

/** Build a path against the API host or same-origin proxy. */
export function buildApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return USE_RELATIVE_API ? normalized : `${API_BASE_URL}${normalized}`;
}

/** Exact URL used for readiness polling — log this in the browser Network tab. */
export const HEALTH_CHECK_URL = buildApiUrl('/health_check');

if (import.meta.env.DEV && !HAS_API_CONFIG) {
  console.error(
    'CRITICAL: Set VITE_API_BASE_URL=http://localhost:8000 in frontend/.env for local development.'
  );
}

if (import.meta.env.PROD) {
  console.info('[api] production routing', {
    USE_RELATIVE_API,
    VITE_API_DIRECT: apiDirect,
    VITE_API_BASE_URL: rawBaseUrl ?? '(unset)',
    HEALTH_CHECK_URL,
    API_URL,
  });
}
