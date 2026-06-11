'use client';

import { useCallback, useRef } from 'react';
import { useConfigPersistence } from '@/features/config-persistence';
import type { PgConnectionConfig } from '@/shared/api/postgres/client';
import { toast } from '@/shared/ui/toast';

interface SetupWizardActionsParams {
  setStep: (step: 'manager' | 'upload' | 'columns') => void;
  setPgConfig: (config: unknown) => void;
  setPgStep: (step: 'connection' | 'browser') => void;
}

/**
 * Инкапсулирует все side-effect действия мастера настройки:
 *  - Импорт конфига через file picker
 *  - Обработчики подключения PostgreSQL
 *  - Успешное завершение синхронизации PG
 *
 * Вынесен из UI-компонента для соблюдения SRP и тестируемости.
 */
export function useSetupWizardActions({
  setStep,
  setPgConfig,
  setPgStep,
}: SetupWizardActionsParams) {
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
      // Очищаем предыдущий обработчик и value
      input.onchange = null;
      input.value = '';

      input.onchange = (ev: Event) => {
        const file = (ev.target as HTMLInputElement).files?.[0];
        if (file) {
          importToDataset(file, datasetId);
        }
        // Сбрасываем value, чтобы можно было выбрать тот же файл повторно
        input.value = '';
      };

      input.click();
    },
    [importToDataset]
  );

  /**
   * Вызывается после успешного теста подключения к PostgreSQL.
   * Сохраняет конфиг и переключает на шаг выбора таблицы.
   */
  const handlePgConnected = useCallback(
    (config: PgConnectionConfig) => {
      setPgConfig(config);
      setPgStep('browser');
    },
    [setPgConfig, setPgStep]
  );

  /**
   * Вызывается после успешной синхронизации таблицы из PostgreSQL.
   * Показывает toast и переходит к шагу настройки колонок.
   */
  const handlePgSyncComplete = useCallback(() => {
    toast.success('Данные из PostgreSQL синхронизированы');
    setStep('columns');
  }, [setStep]);

  return {
    handleImportConfig,
    handlePgConnected,
    handlePgSyncComplete,
  };
}