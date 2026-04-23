import './globals.css';

export const metadata = {
  title: 'Gita AI — Philosophical Assistant',
  description: 'A Bhagavad Gita RAG-based philosophical assistant interface.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
