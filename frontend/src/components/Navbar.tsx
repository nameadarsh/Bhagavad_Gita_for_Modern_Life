import { Link, useLocation } from 'react-router-dom';
import { MessageSquare, Calendar, BookOpen, List } from 'lucide-react';

const Navbar = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Chat', icon: MessageSquare },
    { path: '/daily', label: 'Daily', icon: Calendar },
    { path: '/chapters', label: 'Chapters', icon: BookOpen },
    { path: '/shloks', label: 'All Shloks', icon: List },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-orange-100 md:top-0 md:bottom-auto md:border-t-0 md:border-b z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between md:justify-start md:space-x-10 items-center h-16 md:h-20">
          <Link to="/" className="hidden md:flex items-center space-x-3 text-orange-600 font-extrabold text-2xl group transition-all">
            <div className="p-2 bg-orange-100 rounded-xl group-hover:rotate-12 transition-transform shadow-inner">
              <span>🕉️</span>
            </div>
            <span className="tracking-tight">Gita RAG</span>
          </Link>
          
          <div className="flex justify-around w-full md:w-auto md:space-x-2">
            {navItems.map(({ path, label, icon: Icon }) => {
              const isActive = location.pathname === path;
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex flex-col md:flex-row items-center space-y-1 md:space-y-0 md:space-x-2 px-4 py-2 rounded-2xl transition-all duration-300 ${
                    isActive 
                      ? 'text-orange-600 bg-orange-50 md:bg-orange-50 font-bold' 
                      : 'text-slate-500 hover:text-orange-500 hover:bg-orange-50/50'
                  }`}
                >
                  <Icon size={isActive ? 22 : 20} className={isActive ? 'scale-110' : ''} />
                  <span className="text-[10px] md:text-sm tracking-wide">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
