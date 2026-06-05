'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Хук управления hover-popup для пороговых маркеров на чартах.
 *
 * Логика:
 *  - `show()` — немедленно открывает popup (отменяет pending close)
 *  - `hide()` — закрывает с задержкой `closeDelay` (чтобы курсор успел
 *    перейти с маркера на popup без мерцания)
 *
 * Используется в `ThresholdLabel` для чартов дашборда и групп.
 */
export function useHoverPopup(closeDelay = 120) {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  }, []);

  const hide = useCallback(() => {
    timeoutRef.current = setTimeout(() => setIsOpen(false), closeDelay);
  }, [closeDelay]);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return { isOpen, show, hide };
}