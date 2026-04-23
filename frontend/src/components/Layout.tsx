import type { ReactNode } from 'react';
import Navbar from './Navbar';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-orange-50/30 flex flex-col selection:bg-orange-200 selection:text-orange-900">
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 md:pt-24 md:pb-12">
        <div className="animate-in fade-in duration-700">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
