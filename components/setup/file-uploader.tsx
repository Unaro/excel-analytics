'use client';

import { useCallback, useRef, useState } from 'react';
import { useFileImport } from '@/lib/hooks/use-file-import';
import { UploadCloud, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Добавляем проп
interface FileUploaderProps {
  onSuccess?: () => void;
}

export function FileUploader({ onSuccess }: FileUploaderProps) {
  const { importFile, isUploading, progress, error } = useFileImport();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const processFile = async (file: File) => {
    const success = await importFile(file);
    if (success) {
      toast.success('Файл успешно загружен');
      // Вызываем колбэк перехода
      if (onSuccess) {
        // Небольшая задержка для плавности анимации прогрессбара
        setTimeout(() => onSuccess(), 500);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.csv'))) {
      processFile(file);
    }
  }, [importFile]); // processFile зависит от importFile

  // ... (Остальной JSX рендер без изменений)
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div 
        className={cn(
          "relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 cursor-pointer",
          isDragOver 
            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20" 
            : "border-gray-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-slate-900",
          isUploading && "pointer-events-none opacity-80"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          disabled={isUploading}
        />

        {isUploading ? (
          <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="p-4 bg-indigo-50 dark:bg-slate-800 rounded-full relative">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
            <div className="w-full max-w-xs space-y-3">
              <div className="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>Обработка файла...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 w-full bg-gray-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4">
            <div className={cn(
              "p-4 rounded-full transition-colors",
              isDragOver ? "bg-white dark:bg-slate-800 text-indigo-600" : "bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400"
            )}>
              <UploadCloud className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Загрузите Excel или CSV
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Перетащите файл сюда или нажмите для выбора
              </p>
            </div>
            <Button variant="outline" size="sm" className="mt-2">
              Выбрать файл
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3 text-red-700 dark:text-red-300 animate-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm font-medium">{error}</div>
        </div>
      )}
    </div>
  );
}