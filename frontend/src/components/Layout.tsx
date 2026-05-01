import type { ReactNode } from 'react';
import Navbar from './Navbar';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-orange-50/30 flex flex-col selection:bg-orange-200 selection:text-orange-900">
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 md:pt-24 md:pb-12">
        <div className="animate-in fade-in duration-700">
          {children}
        </div>
      </main>
      <footer className="w-full py-10 px-4 border-t border-orange-100 bg-white/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-slate-400 text-sm leading-relaxed max-w-md mx-auto">
            Your queries are not stored permanently and are used only to generate responses.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
