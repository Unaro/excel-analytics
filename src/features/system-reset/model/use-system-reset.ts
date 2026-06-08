'use client';
import { useState, useCallback } from 'react';
import { clear as clearIdb } from 'idb-keyval';
import { toast } from 'sonner';

/**
 * Управляет полным сбросом системы:
 * 1. Запрос подтверждения через диалог
 * 2. Очистка localStorage и IndexedDB
 * 3. Жёсткая перезагрузка страницы
 */
export function useSystemReset() {
  const [isResetting, setIsResetting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const requestReset = useCallback(() => setIsDialogOpen(true), []);
  const cancelReset = useCallback(() => setIsDialogOpen(false), []);

  const performReset = useCallback(async () => {
    setIsResetting(true);
    try {
      // 1. Очищаем LocalStorage
      localStorage.clear();
      // 2. Очищаем IndexedDB
      await clearIdb();
      toast.success('Система сброшена. Перезагрузка...');
      // 3. Небольшая задержка для отображения toast
      await new Promise(resolve => setTimeout(resolve, 500));
      // 4. Жёсткая перезагрузка
      window.location.href = '/';
    } catch (e) {
      console.error('[SystemReset] Reset failed:', e);
      toast.error('Не удалось полностью очистить данные');
      setIsResetting(false);
    }
  }, []);

  return {
    isResetting,
    isDialogOpen,
    requestReset,
    cancelReset,
    performReset,
  };
}