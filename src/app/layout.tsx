import './globals.css';
import Sidebar from '@/components/sidebar';

export const metadata = {
  title: 'Analytics Platform',
  description: 'Платформа для анализа данных',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <div className="flex min-h-screen bg-gray-50">
          <Sidebar />
          
          <main className="flex-1 overflow-auto">
            <div className="p-6 lg:p-8 pt-20 lg:pt-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
