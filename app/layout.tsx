import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/layout/sidebar';
import { ThemeProvider } from '@/components/providers';
import { Toaster } from 'sonner'; 

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: 'UrbanAnalytics',
  description: 'Градостроительный анализ данных',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors duration-300`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 ml-64">
              {children}
            </main>
          </div>
          <Toaster position="top-right" richColors theme="system" /> 
        </ThemeProvider>
      </body>
    </html>
  );
}