'use client';
import { useRef } from 'react';
import { useConfigPersistence } from '@/features/config-persistence/model/use-config-persistence';
import { useDatasetStore } from '@/entities/dataset';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Download, Upload, Database, AlertCircle } from 'lucide-react';

export function DatasetConfigSection() {
  const { exportDatasetConfig, importToDataset } = useConfigPersistence();
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  const activeDataset = useDatasetStore(s => activeDatasetId ? s.datasets[activeDatasetId] : null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
              onClick={() => fileInputRef.current?.click()}
              variant="default"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Download size={16} className="mr-2" /> Импорт в текущий
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && activeDatasetId) {
                  importToDataset(file, activeDatasetId);
                  e.target.value = '';
                }
              }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}