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

## Features

- **AI Guide**: Conversational chat interface with auto-scroll and thinking indicators.
- **Contextual Wisdom**: Use the "Ask about this" button on any verse to get immediate AI guidance for that specific shlok.
- **Daily Wisdom**: A dedicated page for a fresh daily perspective.
- **Chapter Explorer**: Browse all 18 chapters with speaker and theme breakdowns.
- **Advanced Search**: Filter all 700 verses by Sanskrit, English, or themes.

## Tech Stack

- **React + Vite**: For a fast development experience and optimized builds.
- **TypeScript**: Ensuring type safety across components and API responses.
- **Tailwind CSS**: Modern styling with a responsive card-based layout.
- **Zustand**: Lightweight state management with persistence for chat history.
- **React Router**: Seamless navigation across the single-page application.
- **Axios**: Robust API communication.

## State Management

We use **Zustand** for global state management. The `useChatStore` handles:
- **Session IDs**: Automatically managed to keep conversation context.
- **Message History**: Persisted in the browser's local storage so you don't lose your conversation on refresh.
