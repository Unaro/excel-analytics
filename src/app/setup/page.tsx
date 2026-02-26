'use client';

import { useState } from 'react';
import { FileUploader } from '@/features/UploadExcel';
import { ColumnManager } from '@/features/ManageColumns';
import { useExcelDataStore } from '@/entities/excelData';
import { useStoreHydration } from '@/lib/hooks/use-store-hydration';
import { Trash2, Check, FileSpreadsheet, TableProperties } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { toast } from 'sonner';
import { LoadingScreen } from '@/shared/ui/loading-screen';

export default function SetupPage() {
  const hydrated = useStoreHydration();
  const hasData = useExcelDataStore(s => s.hasData());
  const clearData = useExcelDataStore(s => s.clearData);

  const [step, setStep] = useState<'upload' | 'columns'>(hasData ? 'columns' : 'upload');

  if (!hydrated) {
    return <LoadingScreen message="Загрузка страницы настройки..." />;
  }

  const handleReset = () => {
    if (confirm('Сбросить все данные?')) {
      clearData();
      setStep('upload');
      toast.info('Данные сброшены');
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Данные и Структура</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Загрузка источника данных и настройка типов колонок</p>
        </div>
        {hasData && (
           <Button variant="destructive" size="sm" onClick={handleReset}>
             <Trash2 size={14} className="mr-2" /> Сбросить файл
           </Button>
        )}
      </div>

      {/* STEPPER UI */}
      <div className="relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 dark:bg-slate-800 -z-10 -translate-y-1/2" />
        <div className="flex justify-between w-full max-w-md mx-auto">
          {/* Step 1 */}
          <div className={`flex flex-col items-center gap-2 bg-gray-50 dark:bg-slate-950 px-2 ${step === 'upload' ? 'text-indigo-600' : 'text-slate-500'}`}>
             <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors duration-300
                ${step === 'upload' ? 'border-indigo-600 bg-white dark:bg-slate-900' : hasData ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 dark:border-slate-700 bg-gray-100 dark:bg-slate-800'}
             `}>
               {hasData && step !== 'upload' ? <Check size={20} /> : <FileSpreadsheet size={20} />}
             </div>
             <span className="text-xs font-bold uppercase">1. Загрузка</span>
          </div>

          {/* Step 2 */}
          <div className={`flex flex-col items-center gap-2 bg-gray-50 dark:bg-slate-950 px-2 ${step === 'columns' ? 'text-indigo-600' : 'text-slate-500'}`}>
             <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors duration-300
                ${step === 'columns' ? 'border-indigo-600 bg-white dark:bg-slate-900' : 'border-gray-300 dark:border-slate-700 bg-gray-100 dark:bg-slate-800'}
             `}>
               <TableProperties size={20} />
             </div>
             <span className="text-xs font-bold uppercase">2. Колонки</span>
          </div>
        </div>
      </div>

      {/* Контент */}
      <Card className="p-8 min-h-[400px]">
        {!hasData || step === 'upload' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <FileUploader onSuccess={() => setStep('columns')} />

            {hasData && (
                <div className="mt-6 text-center">
                  <p className="text-slate-500 mb-4">Файл загружен. Перейдите к настройке.</p>
                  <Button onClick={() => setStep('columns')}>
                    Настроить колонки
                  </Button>
                </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ColumnManager />
            <div className="flex justify-end pt-4 border-t dark:border-slate-800">
              <Button
                onClick={() => window.location.href = '/hierarchy'}
                className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
              >
                Далее: Настройка иерархии →
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
