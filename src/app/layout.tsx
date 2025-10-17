import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/sidebar';

export const metadata: Metadata = {
  title: 'Excel Analytics',
  description: 'Анализ данных из Excel таблиц',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <div className="flex">
          <Sidebar />
          <main className="ml-64 flex-1 p-8 bg-gray-50 min-h-screen">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
