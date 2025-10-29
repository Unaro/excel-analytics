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
        <div className="flex ">
          <Sidebar />
          <main className="flex-1 bg-gray-50 h-screen overflow-scroll p-5">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
