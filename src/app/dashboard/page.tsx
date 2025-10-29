'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Loader from '@/components/loader';

export default function DashboardPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Автоматический редирект на /dashboard/overview
    router.push('/dashboard/overview');
  }, [router]);

  return (
    <Loader title='Переход к обзору...' />
  );
}
