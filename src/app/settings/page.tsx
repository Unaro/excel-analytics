'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.push('/settings/main');
  }, [router]);

  return (
    <>
      <Loader /> 
      <span>Переход к настройкам...</span>
    </>
  );
}
