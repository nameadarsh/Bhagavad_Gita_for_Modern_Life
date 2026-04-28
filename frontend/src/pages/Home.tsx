import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="min-h-[calc(100vh-14rem)] flex items-center justify-center">
      <div className="max-w-2xl text-center space-y-6">
        <div className="space-y-3">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800">Bhagavad Gita for Modern Life</h1>
          <p className="text-base md:text-lg text-slate-600">
            Explore chapters, revisit key shloks, and chat with a guide grounded in the Bhagavad Gita.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/chapters"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white border border-orange-200 text-slate-700 hover:border-orange-300 hover:bg-orange-50 transition-colors shadow-sm"
          >
            Start Exploring
          </Link>
          <Link
            to="/chat"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-orange-600 text-white hover:bg-orange-700 transition-colors shadow-sm"
          >
            Go to Chat
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
