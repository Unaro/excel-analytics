'use client';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { ClientOnly } from '@/shared/lib/hydration';
import { LoadingScreen } from '@/shared/ui/loading-screen';
import { useSetupWizard } from '@/features/setup-wizard';
import { useDatasetManager } from '@/features/setup-dataset';
import { useDatasetReplace } from '@/features/setup-dataset';
import { useConfigPersistence } from '@/lib/hooks/use-config-persistence';
import { SetupStepper } from './SetupStepper';
import { DatasetManager } from './DatasetManager';
import { UploadStep } from './UploadStep';
import { ColumnSetupStep } from './ColumnSetupStep';
import { toast } from 'sonner';
import type { PgConnectionConfig } from '@/shared/api/postgres/client';

export function SetupWizardWidget() {
  return (
    <ClientOnly fallback={<LoadingScreen message="Загрузка страницы настройки..." />}>
      <SetupWizardContent />
    </ClientOnly>
  );
}

function SetupWizardContent() {
  const wizard = useSetupWizard();
  const { importToDataset } = useConfigPersistence();

  const { handleDeleteDataset, handleSwitchAndNavigate } = useDatasetManager({
    onNavigateToColumns: () => wizard.setStep('columns'),
    onNavigateToUpload: () => wizard.setStep('upload'),
  });

  const { handleReplaceFile } = useDatasetReplace({
    onSuccess: () => wizard.setStep('columns'),
  });

  const handleImportConfig = (datasetId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (ev: Event) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (file) importToDataset(file, datasetId);
      input.remove();
    };
    input.click();
  };

  const handlePgConnected = (config: PgConnectionConfig) => {
    wizard.setPgConfig(config);
    wizard.setPgStep('browser');
  };

  const handlePgSyncComplete = () => {
    toast.success('Данные из PostgreSQL синхронизированы');
    wizard.setStep('columns');
  };

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
            onDelete={handleDeleteDataset}
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
    </div>
  );
}