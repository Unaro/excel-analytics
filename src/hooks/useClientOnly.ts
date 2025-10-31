// src/hooks/useClientOnly.ts (новый хук)
'use client';

import { useEffect, useState } from 'react';

export function useClientOnly<T>(clientValue: () => T, defaultValue: T): T {
  const [value, setValue] = useState<T>(defaultValue);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setValue(clientValue());
  }, [clientValue]);

  return isClient ? value : defaultValue;
}