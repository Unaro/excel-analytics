'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useDatasetStore } from '@/entities/dataset';
import { useStoreHydration } from '@/lib/hooks/use-store-hydration';
import { FileUploader } from '@/features/UploadExcel';
import { ColumnManager } from '@/features/ManageColumns';
import { PostgresConnectionForm } from '@/features/PostgresConnection';
import { PostgresTableBrowser } from '@/features/PostgresTableBrowser';
import { LoadingScreen } from '@/shared/ui/loading-screen';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { toast } from 'sonner';
import { 
  Trash2, Plus, Database, FileSpreadsheet, ArrowLeft, 
  Check, TableProperties, ChevronRight, Loader2, 
  Upload
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { PgConnectionConfig } from '@/lib/logic/postgres-client';
import {useConfigPersistence} from '@/lib/hooks/use-config-persistence';
import { RawDataViewer } from '@/widgets/RawDataViewer';

export default function SetupPage() {

  const hydrated = useStoreHydration();
  const router = useRouter();

  const datasets = useDatasetStore(s => s.datasets);
  const activeId = useDatasetStore(s => s.activeDatasetId);
  const isSyncing = useDatasetStore(s => s.isSyncing);
  const switchDataset = useDatasetStore(s => s.switchDataset);
  const removeDataset = useDatasetStore(s => s.removeDataset);
  const { importToDataset } = useConfigPersistence();

  const activeDataset = useMemo(() => 
    activeId ? datasets[activeId] : null, 
    [activeId, datasets]
  );
  const hasActiveData = !!activeDataset && !!activeDataset?.rows && activeDataset.rows.length > 0;
  
  const [step, setStep] = useState<'manager' | 'upload' | 'columns'>('manager');
  const [sourceType, setSourceType] = useState<'file' | 'postgres'>('file');
  const [pgConfig, setPgConfig] = useState<PgConnectionConfig | null>(null);
  const [pgStep, setPgStep] = useState<'connection' | 'browser'>('connection');

  useEffect(() => {
    if (!hydrated) return;
    
    if (activeId && !datasets[activeId]) {
      setStep(Object.keys(datasets).length > 0 ? 'manager' : 'upload');
      return;
    }
    
    if (activeId && hasActiveData) {
      setStep('columns');
    } else {
      setStep(Object.keys(datasets).length > 0 ? 'manager' : 'upload');
    }
  }, [hydrated, activeId, hasActiveData, datasets]);

  const handleDeleteDataset = useCallback((id: string) => {
    if (confirm('Удалить этот датасет? Настройки дашбордов сохранятся.')) {
      removeDataset(id);
      toast.info('Датасет удален');
      
      if (id === activeId) {
        const remainingIds = Object.keys(datasets).filter(k => k !== id);
        if (remainingIds.length > 0) {
          switchDataset(remainingIds[0]);
          setStep('columns');
        } else {
          setStep('upload');
        }
      }
    }
  }, [activeId, datasets, removeDataset, switchDataset]);

  if (!hydrated) return <LoadingScreen message="Загрузка страницы настройки..." />;

  const handleFileSuccess = () => {
    setStep('columns');
  };

  const handlePgConnected = (config: PgConnectionConfig) => {
    setPgConfig(config);
    setPgStep('browser');
  };

  const handlePgSyncComplete = () => {
    toast.success('Данные из PostgreSQL синхронизированы');
    setStep('columns');
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Данные и Структура</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Управление источниками данных и настройка типов колонок</p>
        </div>
        {step !== 'manager' && Object.keys(datasets).length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setStep('manager')} className="gap-2">
            <ArrowLeft size={14} /> К списку датасетов
          </Button>
        )}
      </div>

      {/* STEPPER UI */}
      <div className="relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 dark:bg-slate-800 -z-10 -translate-y-1/2" />
        <div className="flex justify-between w-full max-w-md mx-auto">
          <div className={cn("flex flex-col items-center gap-2 bg-gray-50 dark:bg-slate-950 px-2", step === 'upload' || step === 'manager' ? 'text-indigo-600' : 'text-slate-500')}>
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors duration-300",
              step === 'upload' || step === 'manager' ? 'border-indigo-600 bg-white dark:bg-slate-900' : hasActiveData ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 dark:border-slate-700 bg-gray-100 dark:bg-slate-800'
            )}>
              {hasActiveData && step === 'columns' ? <Check size={20} /> : <Database size={20} />}
            </div>
            <span className="text-xs font-bold uppercase">1. Источники</span>
          </div>
          <div className={cn("flex flex-col items-center gap-2 bg-gray-50 dark:bg-slate-950 px-2", step === 'columns' ? 'text-indigo-600' : 'text-slate-500')}>
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors duration-300",
              step === 'columns' ? 'border-indigo-600 bg-white dark:bg-slate-900' : 'border-gray-300 dark:border-slate-700 bg-gray-100 dark:bg-slate-800'
            )}>
              <TableProperties size={20} />
            </div>
            <span className="text-xs font-bold uppercase">2. Колонки</span>
          </div>
        </div>
      </div>

      <Card className="p-8 min-h-[400px]">
        {/* МЕНЕДЖЕР ДАТАСЕТОВ */}
        {step === 'manager' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Загруженные источники</h2>
              <Button onClick={() => setStep('upload')} className="gap-2">
                <Plus size={16} /> Добавить источник
              </Button>
            </div>
            
            <div className="grid gap-3">
              {Object.values(datasets).length === 0 && (
                <div className="text-center py-8 text-slate-400 border-2 border-dashed rounded-xl">
                  Нет загруженных датасетов
                </div>
              )}
              {Object.values(datasets).map(ds => (
                <div key={ds.id} className={cn(
                  "flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer group",
                  ds.id === activeId 
                    ? "border-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/20 dark:border-indigo-800" 
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                )} onClick={() => { switchDataset(ds.id); setStep('columns'); }}>
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", ds.sourceType === 'file' ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20")}>
                      {ds.sourceType === 'file' ? <FileSpreadsheet size={18} /> : <Database size={18} />}
                    </div>
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{ds.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {ds.sourceType === 'file' ? 'Excel/CSV' : `PostgreSQL: ${ds.pgConfig?.schema}.${ds.pgConfig?.table}`} • {ds.rows?.length ?? 0} строк
                      </div>
                    </div>
                    {ds.id === activeId && <Badge variant="outline" className="ml-2 text-[10px] border-indigo-200 text-indigo-600 dark:border-indigo-800 dark:text-indigo-400">Активен</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); handleDeleteDataset(ds.id); }}>
                      <Trash2 size={14} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                      title="Импортировать настройки в этот датасет"
                      onClick={(e) => {
                        e.stopPropagation();
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.json';
                        input.onchange = (ev: Event) => {
                          const file = (ev.target as HTMLInputElement).files?.[0];
                          if (file) {
                            importToDataset(file, ds.id);
                          }
                          input.remove();
                        };
                        input.click();
                      }}
                    >
                      <Upload size={14} />
                    </Button>
                    <ChevronRight size={16} className="text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ЗАГРУЗКА НОВОГО ИСТОЧНИКА */}
        {step === 'upload' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-center">
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
                <button onClick={() => setSourceType('file')} className={cn("flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all", sourceType === 'file' ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400")}>
                  <FileSpreadsheet size={16} /> Excel / CSV
                </button>
                <button onClick={() => setSourceType('postgres')} className={cn("flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all", sourceType === 'postgres' ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400")}>
                  <Database size={16} /> PostgreSQL
                </button>
              </div>
            </div>

            {sourceType === 'file' ? (
              <FileUploader onSuccess={handleFileSuccess} />
            ) : (
              pgStep === 'connection' ? (
                <PostgresConnectionForm onConnected={handlePgConnected} />
              ) : (
                <PostgresTableBrowser config={pgConfig} onComplete={handlePgSyncComplete} />
              )
            )}
          </div>
        )}

        {/* БЛОК НАСТРОЙКИ КОЛОНОК */}
        {step === 'columns' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {isSyncing ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
                        <Loader2 className="animate-spin text-indigo-500" size={32} />
                        <span className="text-sm">Синхронизация данных...</span>
                    </div>
                ) : (
                    <>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                                1. Типы данных
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                Укажите, как система должна интерпретировать каждую колонку.
                            </p>
                            <ColumnManager />
                        </div>

                        <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                                2. Проверка данных
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                Убедитесь, что данные загрузились корректно.
                            </p>
                            <RawDataViewer />
                        </div>

                        <div className="flex justify-end pt-4 border-t dark:border-slate-800">
                            <Button onClick={() => router.push('/hierarchy')} className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700">
                                Далее: Настройка иерархии →
                            </Button>
                        </div>
                    </>
                )}
            </div>
        )}
      </Card>
    </div>
  );
}