'use client';
import { useRef, useState } from 'react';
import { useConfigPersistence } from '@/lib/hooks/use-config-persistence';
import { useDatasetStore } from '@/entities/dataset';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Download, Upload, Database, AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { clear as clearIdb } from 'idb-keyval';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';

export default function SettingsPage() {
  const { exportDatasetConfig, importToDataset } = useConfigPersistence();
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  const activeDataset = useDatasetStore(s => activeDatasetId ? s.datasets[activeDatasetId] : null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isResetting, setIsResetting] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  if (!activeDatasetId) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Настройки</h1>
        <Card className="p-8 text-center border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-800">
          <AlertCircle className="mx-auto h-10 w-10 text-amber-500 mb-3" />
          <p className="text-slate-600 dark:text-slate-300">
            Для управления конфигами выберите или загрузите датасет в разделе <strong>Данные</strong>.
          </p>
        </Card>
      </div>
    );
  }

  const handleFullReset = async () => {
    setIsResetting(true);
    try {
      // 1. Очищаем LocalStorage
      localStorage.clear();

      // 2. Очищаем IndexedDB
      await clearIdb();

      // 3. Небольшая задержка
      await new Promise(resolve => setTimeout(resolve, 500));

      toast.success('Система сброшена. Перезагрузка...');

      // 4. Жесткая перезагрузка
      window.location.href = '/';

    } catch (e) {
      console.error('Reset failed:', e);
      toast.error('Не удалось полностью очистить данные');
      setIsResetting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Настройки</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Управление конфигурацией приложения</p>
      </div>

      <div className="grid gap-6">
        {/* СЕКЦИЯ АКТИВНОГО ДАТАСЕТА */}
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
                  <Download size={16} className="mr-2" /> Экспорт конфига
                </Button>
                <Button onClick={() => fileInputRef.current?.click()} variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Upload size={16} className="mr-2" /> Импорт в текущий
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

        {/* Место для будущего функционала (Шаг 2: Управдение сиротскими датасетами) */}
        <Card className="p-6 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
          <div className="flex items-center gap-3 opacity-50">
            <Database size={18} className="text-slate-400" />
            <div>
              <h3 className="font-medium text-slate-700 dark:text-slate-300">Привязка удалённых источников</h3>
              <p className="text-xs text-slate-400">Функционал будет доступен в следующем обновлении</p>
            </div>
          </div>
        </Card>

          {/* Секция Опасной зоны */}
          <Card className="p-6 border-l-4 border-l-red-500 bg-red-50/30 dark:bg-red-900/10 border-t-0 border-r-0 border-b-0">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg mt-1">
                 <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">Сброс системы</h3>
                <p className="text-sm text-red-600/80 dark:text-red-400/70 mt-1 mb-4">
                  Полная очистка локального хранилища (IndexedDB и LocalStorage).
                  Все данные и настройки будут потеряны безвозвратно.
                </p>
                <Button
                  variant="destructive"
                  onClick={() => setIsResetDialogOpen(true)}
                  disabled={isResetting}
                >
                  {isResetting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Очистка...
                    </>
                  ) : (
                    'Полный сброс'
                  )}
                </Button>
              </div>
            </div>
          </Card>
        
      </div>


      <ConfirmDialog
        open={isResetDialogOpen}
        onOpenChange={setIsResetDialogOpen}
        title="Сбросить систему?"
        description="ВНИМАНИЕ: Это действие удалит ВСЕ данные приложения (дашборды, настройки, загруженный Excel файл). Восстановление будет невозможно."
        variant="destructive"
        isLoading={isResetting}
        onConfirm={handleFullReset}
      />
    </div>
  );
}