// shared/ui/client-only.tsx
'use client';

import { useState, useEffect, type ReactNode } from 'react';

/**
 * Универсальный компонент для предотвращения hydration mismatch.
 * Рендерит children ТОЛЬКО после монтирования на клиенте.
 *
 * Используется в:
 * - widgets/dashboard-list
 * - widgets/group-list
 * - widgets/settings
 * - widgets/setup-wizard
 * - widgets/dashboard-view
 * - widgets/group-view
 *
 * НЕ содержит бизнес-логики или зависимостей от entities.
 */
interface ClientOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return <>{fallback}</>;

  return <>{children}</>;
}