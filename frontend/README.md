# Bhagavad Gita for Modern Life - Frontend

A modern, responsive React application providing an intuitive interface for interacting with the **Bhagavad Gita for Modern Life** AI.

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env` file in the `frontend/` directory:
   ```env
   VITE_API_BASE_URL=http://localhost:8000
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```

## Stopping the App
Press `Ctrl + C` in the terminal to stop the Vite development server.

## Features

- **AI Guide**: Real-time streaming conversational interface with context-aware guidance.
- **Multilingual Support**: Supports 11 Indian languages for both text and audio guidance.
- **Audio System**: High-quality TTS for AI responses and pre-recorded static audio for shloks.
- **Chapter Explorer**: Browse all 18 chapters with themes, speakers, and verse-by-verse breakdowns.
- **Ask about this**: Instantly bridge the gap between ancient verses and modern queries.

## Tech Stack

- **React + Vite**: Fast, modern frontend framework.
- **TypeScript**: Type-safe development for complex state and API flows.
- **Zustand**: Persistent state management for chat history and audio control.
- **Tailwind CSS**: Beautiful, responsive UI with a spiritual aesthetic.
- **Lucide React**: Clean and intuitive iconography.

## State Management

We use **Zustand** with persistence to manage:
- **Chat History**: Messages are saved locally to maintain continuity across sessions.
- **Global Audio**: A centralized controller for seamless playback, preloading, and queuing of audio chunks.
- **User Preferences**: Language selection and session management.
