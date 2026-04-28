# Frontend

The frontend is a React + Vite application that handles routing, warmup UX, chat streaming, and audio playback.

## Setup
```bash
npm install
npm run dev
```

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

## Pages
- `/`: Home landing page
- `/chat`: main chat experience
- `/info`: system explanation and feedback placeholder
- `/daily`, `/chapters`, `/chapter/:id`, `/shloks`: static exploration pages

## Warmup UX
- App load immediately calls backend `/health_check`
- Chat shows a loading state until the backend is ready
- Warmup retries every 10 seconds, times out after 90 seconds, and can be restarted with a retry button
- Queued chat input is preserved and auto-sent once readiness is reached
- A temporary "Chat is ready" notice appears when warmup completes

## Audio System
- AI response audio is generated through `/api/v1/tts`
- Verse cards and referenced verses can play static audio from Supabase
- Global audio playback is coordinated through the persisted chat store

## State Management
- `chatStore`: session id, messages, language, and global audio state
- `backendStore`: readiness, timeout, retry, and warmup lifecycle state
