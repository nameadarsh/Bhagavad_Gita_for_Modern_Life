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

function App() {
  useEffect(() => {
    document.title = "Clarity";
  }, []);

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
