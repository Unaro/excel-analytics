'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

interface ThemeProviderProps extends React.ComponentProps<typeof NextThemesProvider> {
  children: React.ReactNode;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    setIsReady(true);
  }, []);

  // Во время первого рендера (SSR/hydration) возвращаем фрагмент без провайдера
  // Это предотвращает ошибки useContext при билде
  if (!isReady) {
    return (
      <NextThemesProvider {...props}>
        {children}
      </NextThemesProvider>
    );
  }

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
