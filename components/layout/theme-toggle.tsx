'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Ждем маунта на клиенте, чтобы избежать ошибок гидратации
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Рендерим заглушку того же размера, чтобы интерфейс не прыгал
    return <div className="w-[108px] h-[36px] bg-gray-100 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700" />;
  }

  return (
    <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
      <button
        onClick={() => setTheme('light')}
        className={`p-1.5 rounded-md transition-all ${
          theme === 'light' 
            ? 'bg-white text-yellow-500 shadow-sm dark:bg-slate-700' 
            : 'text-gray-400 hover:text-gray-600 dark:hover:text-slate-300'
        }`}
        title="Светлая"
      >
        <Sun size={16} />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`p-1.5 rounded-md transition-all ${
          theme === 'system' 
            ? 'bg-white text-blue-500 shadow-sm dark:bg-slate-600 dark:text-blue-400' 
            : 'text-gray-400 hover:text-gray-600 dark:hover:text-slate-300'
        }`}
        title="Системная"
      >
        <Monitor size={16} />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`p-1.5 rounded-md transition-all ${
          theme === 'dark' 
            ? 'bg-slate-600 text-indigo-400 shadow-sm' 
            : 'text-gray-400 hover:text-gray-600 dark:hover:text-slate-300'
        }`}
        title="Темная"
      >
        <Moon size={16} />
      </button>
    </div>
  );
}