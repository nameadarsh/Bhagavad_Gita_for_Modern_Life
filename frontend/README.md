# Frontend

React + Vite + TypeScript SPA: static Gita browsing, streaming chat, feedback, and global audio playback. Branding in the UI is **Clarity**.

## Run

```bash
npm install
npm run dev
```

## Environment

`frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Build-time: set `VITE_API_BASE_URL` to your production API origin before `npm run build`.

## Readiness and warmup

- **`useBackendReadiness`** (used from `App.tsx`) polls **`GET {VITE_API_BASE_URL}/health_check`** until `rag_available` is true.  
- Polling is **sequential** (one request at a time): ~**4 s** between polls, **~120 s** total budget, **~130 s** per request timeout (cold `health_check` can take a long time while the server loads in a background thread).  
- **`backendStore`** holds `isBackendReady`, warming/timeout flags, and `restartWarmup` for UI retries.  
- **Retry:** the layout banner calls **`POST …/api/v1/warmup/retry`** then `restartWarmup()` so polling resumes after a backend `failed` state.

Chat input stays disabled until the backend is ready (or the wait budget is exceeded).

## Chat and API

- Streaming chat uses **`fetch`** to `POST /api/v1/chat` with a **long** client-side timeout until headers (server completes retrieval + LLM before streaming). See `src/services/api.ts`.  
- TTS and feedback use Axios (`/api/v1/tts`, `/api/v1/feedback`); feedback disables the global 5xx retry.

## Pages

`/`, `/chat`, `/info`, `/daily`, `/chapters`, `/chapter/:id`, `/shloks`

## State

- **`chatStore`** (persisted): session id, messages, language, global audio.  
- **`backendStore`**: readiness and warmup UI state.
