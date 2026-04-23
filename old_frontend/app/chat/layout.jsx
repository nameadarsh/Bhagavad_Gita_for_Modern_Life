import Sidebar from '../../components/Sidebar/Sidebar';

export default function ChatLayout({ children }) {
  return (
    <div className="flex flex-row h-screen overflow-hidden bg-[--color-bg-base]">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}
