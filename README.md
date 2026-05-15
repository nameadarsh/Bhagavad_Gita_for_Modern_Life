# Bhagavad Gita for Modern Life

RAG-backed web app (“Clarity”): users ask life questions, the backend retrieves a relevant Bhagavad Gita verse (FAISS + embeddings), generates grounded guidance (LLM), and streams the reply. Optional TTS and static verse audio are supported.

## Project structure

| Path | Role |
|------|------|
| `frontend/` | React (Vite + TypeScript), UI, client polling, SSE chat |
| `backend/` | FastAPI API, RAG, LLM, TTS, data under `backend/data/` |
| `runtime.txt` | Python version hint for hosts (e.g. 3.11) |

Static Gita text for browsing lives in the frontend bundle (`frontend/src/data/`); the API owns retrieval and generation.

## Tech stack

- **Frontend:** React, Vite, TypeScript, Zustand, Tailwind, React Router  
- **Backend:** FastAPI, FAISS, FastEmbed, remote LLMs (e.g. Groq), Sarvam TTS, Supabase storage  

## Architecture (concise)

**Backend**  
Single FastAPI app (`backend/app/main.py`). RAG and services are loaded once in a **background warmup** started from an **application lifespan** hook: synchronous load runs in **`asyncio.to_thread`** so the event loop is not blocked. Chat and TTS handlers require `app.state.rag_available`; they return **503** until warmup succeeds. There is **no** RAG load in HTTP middleware.

**Frontend**  
`useBackendReadiness` (mounted from `App.tsx`) polls **`GET /health_check`** on a fixed schedule until `rag_available` is true, the backend reports **failed**, or a **total wait budget** elapses. The layout shows status and **Retry**; retry calls **`POST /api/v1/warmup/retry`** then restarts polling. Chat send stays disabled until the store marks the backend ready.

**Chat transport**  
`POST /api/v1/chat` returns **SSE**. The server finishes retrieval and the main LLM call before streaming chunks, so the client uses a **long connection timeout** for the initial response (see `frontend/src/services/api.ts`).

## Startup lifecycle

1. Process starts → `create_app()` registers routes and state.  
2. **Lifespan startup** → schedules `warmup_worker` → `asyncio.to_thread(_sync_load_rag, ...)`.  
3. **`warmup_status`**: `starting` → `warming_up` → **`ready`** or **`failed`**.  
4. **`rag_available`** becomes `true` only after a successful load.  
5. On shutdown, the warmup task is cancelled if still running.

## Warmup and readiness

| `warmup_status` | Meaning |
|-----------------|--------|
| `starting` | Lifespan began; scheduler not finished yet (brief). |
| `warming_up` | Background load in progress. |
| `ready` | RAG stack and services initialized; chat/TTS allowed. |
| `failed` | Load failed; see `warmup_error` on `health_check` when present. |

**Recovery:** `POST /api/v1/warmup/retry` schedules another warmup (guarded so only one run is active at a time). The UI retry button invokes this, then re-runs the polling loop.

## Health endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness + observed flags: `status: "alive"`, `warmup_status`, `rag_available`, `rag_loading`. **Read-only**; does not load models. |
| `GET /health_check` | **Readiness for clients.** Same observed state; `status` is `"ok"` when `rag_available` is true for backward compatibility, otherwise mirrors `warmup_status`. Optional `warmup_error` when `failed`. |
| `GET /` | Basic JSON metadata. |

## Retry behavior

- **Frontend polling:** Sequential requests (no overlapping polls per hook instance); ~4s between polls; ~120s total wait window; long timeout per `health_check` request to tolerate slow cold loads.  
- **Axios:** One automatic retry on 5xx for most calls; **feedback** opts out (`skipRetry`) to avoid duplicate submissions.  
- **Warmup retry:** Explicit `POST /api/v1/warmup/retry` after a failed phase.

## Cold start

- First server start pays the cost of loading FAISS, JSON, and the embedding model **off the event loop**; HTTP handlers stay responsive.  
- Until `rag_available` is true, chat returns **503** with an existing user-facing message.  
- The SPA shows a banner until readiness or failure; users can **Retry** after failure.

## Environment requirements

**Backend (`backend/.env`)** — see `backend/README.md` and `backend/.env.example`. Minimum includes `LLM_PROVIDER`, `SMALL_LLM_PROVIDER`, `LLM_API_KEYS`, plus Supabase and Sarvam TTS keys. Prefer **`SARVAM_API_KEYS=key1,key2`** for automatic quota failover; legacy **`SARVAM_API_KEY`** still works when the list is unset.

**Frontend (`frontend/.env`)**

```env
VITE_API_BASE_URL=http://localhost:8000
```

Omitting this fails readiness polling and API calls (a clear console message is logged once).

## Setup and run

**Backend**

```bash
cd backend
python3 -m venv ../venv
source ../venv/bin/activate   # Windows: ..\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

**Production build (frontend)**

```bash
cd frontend
npm run build
```

Serve the `frontend/dist/` output with any static host; point `VITE_API_BASE_URL` at the deployed API origin at build time.

## Deployment notes

- Use **one** API base URL in the built frontend (`VITE_API_BASE_URL`).  
- Configure CORS / `FRONTEND_URL` as needed (`backend/app/main.py`).  
- Each API worker process runs **its own** warmup and holds **its own** in-memory RAG (typical for this design).  
- Do not commit `.env`, `venv/`, `node_modules/`, or `backend/logs/` (see `.gitignore`).

## Recent architectural improvements

- RAG initialization moved from **request middleware** to **lifespan + background thread** (`asyncio.to_thread`), with explicit **`warmup_status`** and a **retry** endpoint.  
- **`GET /health_check`** is read-only and safe to poll aggressively from the SPA.  
- Frontend readiness polling, chat gating, and stream timeouts aligned with real server behavior.

## Known limitations

- Chat still **buffers the full LLM reply** before SSE begins; time-to-first-byte includes that work.  
- **Sessions** are in-memory (`app.state.sessions`); they do not survive restarts or horizontal scale-out without redesign.  
- **Multi-worker** deployments duplicate memory per worker (each runs warmup).  
- **Feedback** and other non-RAG routes do not require RAG; chat/TTS do.

## Future improvements (optional)

- Token streaming from the LLM instead of chunking a completed answer.  
- Shared RAG cache or dedicated worker pool for multi-replica hosts.  
- External session store if sticky sessions are not enough.

## API summary

- `GET /health`, `GET /health_check` — observability / readiness  
- `POST /api/v1/warmup/retry` — reschedule warmup after failure  
- `POST /api/v1/chat` — SSE chat  
- `POST /api/v1/tts` — TTS JSON  
- `POST /api/v1/feedback` — feedback form  

More detail: `backend/README.md`, `frontend/README.md`.
