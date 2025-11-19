'use client';

import { useState } from 'react';
import { useConfigPersistence } from '@/lib/hooks/use-config-persistence';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, Upload, AlertTriangle, Loader2 } from 'lucide-react';
import { useRef } from 'react';
import { clear } from 'idb-keyval'; // <--- ИМПОРТИРУЕМ ФУНКЦИЮ ОЧИСТКИ
import { toast } from 'sonner';

export default function SettingsPage() {
  const { exportConfig, importConfig } = useConfigPersistence();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isResetting, setIsResetting] = useState(false);

  const handleFullReset = async () => {
    if (!confirm('ВНИМАНИЕ: Вы действительно хотите стереть ВСЕ данные приложения?\n\nЭто действие удалит:\n- Загруженный Excel файл\n- Все дашборды\n- Все настройки групп и метрик')) {
      return;
    }

    setIsResetting(true);
    try {
      // 1. Очищаем LocalStorage (Синхронно)
      // Здесь хранятся настройки Zustand (кроме Excel)
      localStorage.clear();

      // 2. Очищаем IndexedDB (Асинхронно) - Самое важное для Excel
      // Используем функцию clear() из библиотеки, она корректно очистит хранилище
      await clear();

      // 3. Небольшая задержка для уверенности
      await new Promise(resolve => setTimeout(resolve, 500));

      toast.success('Система сброшена. Перезагрузка...');
      
      // 4. Жесткая перезагрузка на главную
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
        
        {/* Секция Бэкапа */}
        <Card className="p-6 border-l-4 border-l-indigo-500">
          <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-white">Резервное копирование</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Вы можете сохранить все настройки (дашборды, группы, формулы, иерархию) в JSON файл. 
            Данные самого Excel файла <strong>не сохраняются</strong> — их нужно будет загрузить отдельно.
          </p>
          
          <div className="flex gap-4">
            <Button onClick={exportConfig} variant="outline">
              <Download size={16} className="mr-2" /> Экспорт настроек
            </Button>

            <Button onClick={() => fileInputRef.current?.click()} variant="outline">
              <Upload size={16} className="mr-2" /> Импорт настроек
            </Button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  importConfig(file);
                  e.target.value = '';
                }
              }}
            />
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
                onClick={handleFullReset}
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
    </div>
  );
}