'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Автоматический редирект на /dashboard/overview
    router.push('/dashboard/overview');
  }, [router]);

  return (
    <>
    <Loader /> <span>Переход к обзору...</span>
    </>
  );
}
