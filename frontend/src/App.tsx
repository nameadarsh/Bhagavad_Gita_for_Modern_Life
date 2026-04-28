import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Chat from './pages/Chat';
import InfoPage from './pages/InfoPage';
import Daily from './pages/Daily';
import Chapters from './pages/Chapters';
import ChapterDetail from './pages/ChapterDetail';
import AllShloks from './pages/AllShloks';
import { backendApi } from './services/api';
import { useBackendStore } from './store/backendStore';

const WARMUP_RETRY_MS = 10000;
const WARMUP_TIMEOUT_MS = 60000;

function App() {
  const {
    isBackendReady,
    warmupAttempt,
    setBackendReady,
    setWarmingUp,
    setWarmupTimedOut,
  } = useBackendStore();

  useEffect(() => {
    if (isBackendReady) {
      setWarmingUp(false);
      setWarmupTimedOut(false);
      return;
    }

    let cancelled = false;
    let isPinging = false;
    let hasExpired = false;
    let intervalId: number | undefined;
    let timeoutId: number | undefined;

    const pingBackend = async () => {
      if (cancelled || isPinging) {
        return;
      }

      isPinging = true;
      setWarmingUp(true);
      const ready = await backendApi.warmup();
      isPinging = false;

      if (cancelled || hasExpired) {
        return;
      }

      if (ready) {
        setBackendReady(true);
        setWarmingUp(false);
        setWarmupTimedOut(false);
        if (intervalId) {
          window.clearInterval(intervalId);
        }
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
      }
    };

    void pingBackend();

    intervalId = window.setInterval(() => {
      const { isBackendReady: ready, warmupTimedOut } = useBackendStore.getState();
      if (ready || warmupTimedOut) {
        window.clearInterval(intervalId);
        return;
      }

      void pingBackend();
    }, WARMUP_RETRY_MS);

    timeoutId = window.setTimeout(() => {
      if (useBackendStore.getState().isBackendReady) {
        return;
      }

      setWarmingUp(false);
      setWarmupTimedOut(true);
      hasExpired = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    }, WARMUP_TIMEOUT_MS);

    return () => {
      cancelled = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isBackendReady, setBackendReady, setWarmupTimedOut, setWarmingUp, warmupAttempt]);

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/info" element={<InfoPage />} />
          <Route path="/daily" element={<Daily />} />
          <Route path="/chapters" element={<Chapters />} />
          <Route path="/chapter/:id" element={<ChapterDetail />} />
          <Route path="/shloks" element={<AllShloks />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
