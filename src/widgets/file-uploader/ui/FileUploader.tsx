'use client';

import { useCallback, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';

interface FileUploaderProps {
  /**
   * Файл выбран. Импорт здесь НЕ запускается — выбор уходит наверх в визард,
   * который строит лёгкий предпросмотр и ведёт на шаг «Импорт».
   */
  onFileSelected: (file: File) => void;
}

export function FileUploader({ onFileSelected }: FileUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (
      file &&
      (file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls') ||
        file.name.endsWith('.csv'))
    ) {
      onFileSelected(file);
    }
  }, [onFileSelected]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className={cn(
          "relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 cursor-pointer",
          isDragOver
            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20"
            : "border-gray-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-slate-900"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => {
          if (typeof document !== 'undefined') {
            fileInputRef.current?.click();
          }
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
        />

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
      </div>
    </div>
  );
}
