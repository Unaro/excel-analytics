'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

interface ThemeProviderProps extends React.ComponentProps<typeof NextThemesProvider> {
  children: React.ReactNode;
}

/**
 * Обёртка над next-themes.
 *
 * Ранее содержала useState/useEffect с «isReady», обе ветки которого
 * рендерили одно и то же (п.13 аудита) — no-op удалён: next-themes
 * сам корректно обрабатывает SSR/гидрацию через suppressHydrationWarning
 * на html-элементе.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
