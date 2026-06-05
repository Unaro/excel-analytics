'use client';

import { useDatasetStore } from '@/entities/dataset';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Download, Upload, Database, AlertCircle } from 'lucide-react';
import { useConfigPersistence } from '@/features/config-persistence';
import { useSettingsActions } from '../model/use-settings-actions';

export function DatasetConfigSection() {
  const { exportDatasetConfig } = useConfigPersistence();
  const { handleImportConfig } = useSettingsActions();
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  const activeDataset = useDatasetStore(s => activeDatasetId ? s.datasets[activeDatasetId] : null);

  if (!activeDatasetId) {
    return (
      <Card className="p-8 text-center border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-800">
        <AlertCircle className="mx-auto h-10 w-10 text-amber-500 mb-3" />
        <p className="text-slate-600 dark:text-slate-300">
          Для управления конфигами выберите или загрузите датасет в разделе <strong>Данные</strong>.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-l-4 border-l-emerald-500">
      <div className="flex items-start gap-4">
        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg">
          <Database size={20} />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Конфиг: {activeDataset?.name}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">
            Экспорт или импорт настроек <strong>только для этого датасета</strong>.
            Дашборды, группы и иерархия будут привязаны к текущему источнику данных.
          </p>
          <div className="flex gap-4">
            <Button onClick={() => exportDatasetConfig(activeDatasetId)} variant="outline">
              <Upload size={16} className="mr-2" /> Экспорт конфига
            </Button>
            <Button
              onClick={() => handleImportConfig(activeDatasetId)}
              variant="default"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Download size={16} className="mr-2" /> Импорт в текущий
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}