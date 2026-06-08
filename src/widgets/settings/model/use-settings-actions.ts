'use client';

import { useRef, useCallback } from 'react';
import { useConfigPersistence } from '@/features/config-persistence';

/**
 * Инкапсулирует side-effect действия виджета настроек:
 *  - Импорт конфига через скрытый file picker
 *  - Сброс value после выбора (для возможности повторного выбора того же файла)
 *
 * Вынесен из UI-компонента для соблюдения SRP и тестируемости.
 */
export function useSettingsActions() {
  const { importToDataset } = useConfigPersistence();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Открывает системный диалог выбора JSON-файла и импортирует
   * конфигурацию в указанный датасет.
   */
  const handleImportConfig = useCallback(
    (datasetId: string) => {
      // Lazy-создание input-элемента (только при первом вызове)
      if (!fileInputRef.current) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        fileInputRef.current = input;
      }

      const input = fileInputRef.current;
      input.onchange = null;
      input.value = '';

      input.onchange = (ev: Event) => {
        const file = (ev.target as HTMLInputElement).files?.[0];
        if (file) {
          importToDataset(file, datasetId);
        }
        input.value = '';
      };

      input.click();
    },
    [importToDataset]
  );

  return {
    handleImportConfig,
  };
}