'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Loader from '@/components/loader';

export default function SettingsPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.push('/settings/main');
  }, [router]);

  return (
    <Loader title='Переход к настройкам...' />
  );
}
