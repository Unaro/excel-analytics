// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Мгновенный редирект
    router.push('/dashboard/overview');

    // Фолбэк: через 3 сек показать кнопку
    const t = setTimeout(() => {
      if (!cancelled) setFailed(true);
    }, 3000);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-4" aria-live="polite" aria-busy={!failed}>
        <div className="flex items-center justify-center gap-3 text-gray-700">
          <Loader className="h-5 w-5 animate-spin text-blue-600" />
          <span className="font-medium">Переход к обзору...</span>
        </div>
        <p className="text-sm text-gray-500">
          Откроется раздел обзора дашборда с ключевыми метриками.
        </p>

        {failed && (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Если страница не открылась автоматически, нажмите кнопку ниже.
            </p>
            <Link
              href="/dashboard/overview"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Открыть обзор
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
