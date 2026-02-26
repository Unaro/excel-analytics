'use client';

// Отключаем статическую генерацию для этой страницы
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { DashboardBuilder } from '@/widgets/DashboardBuilder';
import { LoadingScreen } from '@/shared/ui/loading-screen';

export default function NewDashboardPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <LoadingScreen message="Загрузка..." />;
  }

  return <DashboardBuilder />;
}
