import { Link } from 'react-router-dom';
import { MessageSquare, BookOpen, Heart, Globe, Target } from 'lucide-react';

const Home = () => {
  const languages = [
    'English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 
    'Malayalam', 'Marathi', 'Gujarati', 'Bengali', 'Punjabi'
  ];

  return (
    <div className="bg-orange-50/30 font-sans">
      <div className="max-w-5xl mx-auto px-4 py-16 space-y-24">
        
        {/* HERO SECTION */}
        <section className="text-center space-y-8 py-20">
          <div className="space-y-6">
            <h1 className="text-6xl md:text-7xl font-extrabold text-slate-800 tracking-tight">
              Clarity
            </h1>
            <h2 className="text-xl md:text-3xl font-medium text-orange-600 max-w-2xl mx-auto leading-tight">
              Guidance for real-life situations, based on the Bhagavad Gita
            </h2>
            <p className="max-w-xl mx-auto text-slate-600 text-lg leading-relaxed">
              Ask about any situation you're facing and receive thoughtful guidance grounded in timeless wisdom.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              to="/chat"
              className="w-full sm:w-auto bg-orange-600 text-white px-10 py-4 rounded-2xl shadow-lg hover:bg-orange-700 hover:scale-[1.02] transition-all duration-200 font-bold text-lg flex items-center justify-center gap-2"
            >
              <MessageSquare size={20} />
              Start Conversation
            </Link>
            <Link
              to="/chapters"
              className="w-full sm:w-auto bg-white border border-orange-200 text-slate-700 px-10 py-4 rounded-2xl shadow-sm hover:bg-orange-50 transition-all duration-200 font-semibold text-lg flex items-center justify-center gap-2"
            >
              <BookOpen size={20} />
              Explore Chapters
            </Link>
          </div>
        </section>

        {/* VALUE SECTION */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: "Real-life clarity",
              desc: "Get guidance for confusion, stress, and decisions",
              icon: <Target className="text-orange-600 mb-4" size={32} />
            },
            {
              title: "Timeless Wisdom",
              desc: "Responses are grounded in authentic Bhagavad Gita teachings",
              icon: <BookOpen className="text-orange-600 mb-4" size={32} />
            },
            {
              title: "Compassionate AI",
              desc: "A safe space to reflect on your challenges and path",
              icon: <Heart className="text-orange-600 mb-4" size={32} />
            }
          ].map((card, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-md p-10 border border-orange-100 hover:shadow-lg transition-shadow duration-300">
              {card.icon}
              <h3 className="text-2xl font-bold text-slate-800 mb-3">{card.title}</h3>
              <p className="text-slate-600 leading-relaxed text-lg">{card.desc}</p>
            </div>
          ))}
        </section>

        {/* MULTILINGUAL SUPPORT */}
        <section className="text-center space-y-10 py-8">
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="p-3 bg-orange-50 rounded-2xl">
                <Globe className="text-orange-600" size={32} />
              </div>
            </div>
            <h2 className="text-4xl font-bold text-slate-800">Understand in your language</h2>
            <p className="text-slate-600 text-xl max-w-2xl mx-auto">Receive guidance in multiple Indian languages for better clarity and comfort.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
            {languages.map((lang) => (
              <span 
                key={lang} 
                className="px-6 py-3 rounded-2xl bg-white border border-orange-200 shadow-sm text-base font-semibold text-slate-700 hover:border-orange-300 transition-colors"
              >
                {lang}
              </span>
            ))}
          </div>
        </section>

        {/* HOW TO USE */}
        <section className="bg-white rounded-[2.5rem] p-12 md:p-20 shadow-xl border border-orange-50 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <h2 className="text-4xl font-bold text-slate-800 leading-tight">How it helps you find peace</h2>
            <ul className="space-y-6">
              {[
                'Gain perspective on complex decisions',
                'Navigate emotional stress and anxiety',
                'Practice mindfulness in daily reactions',
                'Connect with traditional wisdom'
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-4 text-slate-600 text-lg">
                  <div className="flex-shrink-0 h-3 w-3 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-10">
            <div className="space-y-8">
              {[
                { step: 1, text: "Share your situation or question" },
                { step: 2, text: "Receive relevant guidance and shlokas" },
                { step: 3, text: "Reflect and apply wisdom to your life" }
              ].map((item) => (
                <div key={item.step} className="flex items-center gap-6 group">
                  <span className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-2xl bg-orange-50 text-orange-600 font-extrabold text-xl group-hover:bg-orange-600 group-hover:text-white transition-all duration-300 shadow-sm">
                    {item.step}
                  </span>
                  <p className="text-slate-700 font-bold text-xl">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="bg-orange-600 rounded-[2.5rem] p-16 text-center space-y-10 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32 group-hover:scale-110 transition-transform duration-700" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-black opacity-5 rounded-full -ml-32 -mb-32 group-hover:scale-110 transition-transform duration-700" />
          
          <div className="relative z-10 space-y-6">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white">Ready for your first session?</h2>
            <p className="text-orange-100 text-xl max-w-xl mx-auto font-medium">Step into a world of clarity and timeless wisdom today.</p>
          </div>
          
          <Link
            to="/chat"
            className="relative z-10 inline-flex items-center gap-3 bg-white text-orange-600 px-12 py-5 rounded-2xl shadow-xl hover:scale-105 transition-all duration-300 font-extrabold text-2xl"
          >
            Go to Chat
            <MessageSquare size={24} />
          </Link>
        </section>
      </div>
    </div>
  );
};

export default Home;