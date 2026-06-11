'use client';

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { useDatasetManager } from '@/features/setup-dataset';
import { useDatasetReplace } from '@/features/setup-dataset';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import type { PgConnectionConfig } from '@/shared/api/postgres/client';

import { useSetupWizardActions } from '../model/use-setup-wizard-actions';
import { SetupStepper } from './SetupStepper';
import { DatasetManager } from './DatasetManager';
import { UploadStep } from './UploadStep';
import { ColumnSetupStep } from './ColumnSetupStep';
import { useSetupWizard } from '../model/use-setup-wizard';

/**
 * Приватный оркестратор мастера настройки.
 *
 * Отвечает за:
 *  1. Получение состояния мастера из `useSetupWizard`
 *  2. Делегирование side-effects в `useSetupWizardActions`
 *  3. Делегирование CRUD операций в `useDatasetManager` / `useDatasetReplace`
 *  4. Композицию шагов мастера (Manager / Upload / Columns)
 *  5. Рендер стёппера и кнопки "Назад"
 *
 * НЕ должен экспортироваться наружу — используется только SetupWizardWidget.
 */
export function SetupWizardContent() {
  const wizard = useSetupWizard();

  const {
    pendingDeleteId,
    requestDeleteDataset,
    cancelDeleteDataset,
    confirmDeleteDataset,
    handleSwitchAndNavigate,
  } = useDatasetManager({
    onNavigateToColumns: () => wizard.setStep('columns'),
    onNavigateToUpload: () => wizard.setStep('upload'),
  });

  const { handleReplaceFile, pendingReplace, cancelReplace, confirmReplace } =
    useDatasetReplace({
      onSuccess: () => wizard.setStep('columns'),
    });

  const {
    handleImportConfig,
    handlePgConnected,
    handlePgSyncComplete,
  } = useSetupWizardActions({
    setStep: wizard.setStep,
    setPgConfig: wizard.setPgConfig,
    setPgStep: wizard.setPgStep,
  });

  const showBackButton =
    wizard.step !== 'manager' && wizard.hasMultipleDatasets;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Заголовок */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Данные и Структура
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Управление источниками данных и настройка типов колонок
          </p>
        </div>
        {showBackButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => wizard.setStep('manager')}
            className="gap-2"
          >
            <ArrowLeft size={14} /> К списку датасетов
          </Button>
        )}
      </div>

      {/* Степпер */}
      <SetupStepper
        step={wizard.step}
        hasActiveData={wizard.hasActiveData}
      />

      {/* Контент */}
      <Card className="p-8 min-h-[400px]">
        {wizard.step === 'manager' && (
          <DatasetManager
            datasets={wizard.datasets}
            activeId={wizard.activeId}
            onAddNew={() => wizard.setStep('upload')}
            onSelect={handleSwitchAndNavigate}
            onDelete={requestDeleteDataset}
            onReplace={handleReplaceFile}
            onImportConfig={handleImportConfig}
          />
        )}
        {wizard.step === 'upload' && (
          <UploadStep
            sourceType={wizard.sourceType}
            pgStep={wizard.pgStep}
            pgConfig={wizard.pgConfig as PgConnectionConfig | null}
            onSourceTypeChange={wizard.setSourceType}
            onFileSuccess={() => wizard.setStep('columns')}
            onPgConnected={handlePgConnected}
            onPgSyncComplete={handlePgSyncComplete}
          />
        )}
        {wizard.step === 'columns' && (
          <ColumnSetupStep isSyncing={wizard.isSyncing} />
        )}
      </Card>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(v) => !v && cancelDeleteDataset()}
        title="Удалить датасет?"
        description="Будут удалены данные, кэш вычислений и настройки колонок. Настройки дашбордов, метрики и группы сохранятся."
        variant="destructive"
        onConfirm={confirmDeleteDataset}
      />

      <ConfirmDialog
        open={pendingReplace !== null}
        onOpenChange={(v) => !v && cancelReplace()}
        title={`Заменить файл для датасета «${pendingReplace?.datasetName ?? ''}»?`}
        description="Новые данные загрузятся в DuckDB; настройки колонок сохранятся, кэш вычислений сбросится, удалённые колонки будут помечены как скрытые."
        onConfirm={confirmReplace}
      />
    </div>
  );
}