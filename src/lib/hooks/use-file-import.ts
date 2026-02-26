'use client';

import { useState, useCallback } from 'react';
import { useExcelDataStore } from '@/entities/excelData';
import { useColumnConfigStore } from '@/entities/excelData';
import { parseExcelFile } from '@/app/actions/parse'; 
import { ColumnConfig, ColumnClassification } from '@/types';
import { transliterate } from '@/shared/lib/utils/translit';

export function useFileImport() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const setData = useExcelDataStore((s) => s.setData);
  
  // Достаем конфиги и метод установки
  const existingConfigs = useColumnConfigStore((s) => s.configs);
  const setConfigs = useColumnConfigStore((s) => s.setConfigs);

  const handleFileUpload = useCallback(async (file: File): Promise<boolean> => {
    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(10);

    try {
      const buffer = await file.arrayBuffer();
      setUploadProgress(30);

      const { data, metadata } = await parseExcelFile(buffer, file.name);
      setUploadProgress(60);

      if (data.length === 0) {
        throw new Error('Файл пуст или не содержит данных');
      }

      // Обновляем сырые данные
      setData(data, metadata);

      // Генерация конфигов с сохранением старых настроек
      const firstSheet = data[0];
      const headers = firstSheet.headers;
      const rows = firstSheet.rows; 

      const newConfigs: ColumnConfig[] = [];

      for (const header of headers) {
        const existingConfig = existingConfigs.find(c => c.columnName === header);

        if (existingConfig) {
          newConfigs.push(existingConfig);
        } else {
          // Если колонки раньше не было - запускаем авто-определение
          const sampleValues = rows.slice(0, 100).map(r => r[header]).filter(v => v != null);
          const isNumeric = sampleValues.length > 0 && sampleValues.every(v => typeof v === 'number');
          
          let classification: ColumnClassification = 'ignore';
          if (isNumeric) classification = 'numeric';
          else if (sampleValues.length > 0) classification = 'categorical';

          const safeAlias = transliterate(header);

          newConfigs.push({
            columnName: header,
            displayName: header,
            alias: safeAlias || `col_${Math.random().toString(36).substr(2, 5)}`,
            classification: classification,
            description: `Авто-определено из файла ${file.name}`
          });
        }
      }
      
      setUploadProgress(90);
      
      setConfigs(newConfigs);
      
      setUploadProgress(100);
      return true; 
    } catch (err) {
      console.error('Import failed:', err);
      setUploadError(err instanceof Error ? err.message : 'Ошибка загрузки');
      return false; 
    } finally {
      setIsUploading(false);
    }
  }, [setData, setConfigs, existingConfigs]);

  return {
    importFile: handleFileUpload,
    isUploading,
    error: uploadError,
    progress: uploadProgress
  };
}