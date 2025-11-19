'use client';

import { useState, useCallback } from 'react';
import { useExcelDataStore } from '@/lib/stores/excel-data-store';
import { useColumnConfigStore } from '@/lib/stores/column-config-store';
import { parseExcelFile } from '@/app/actions/parse'; 
import { ColumnConfig, ColumnClassification } from '@/types';
import { transliterate } from '@/lib/utils/translit';

export function useFileImport() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const setData = useExcelDataStore((s) => s.setData);
  const setConfigs = useColumnConfigStore((s) => s.setConfigs);

  // Возвращаем Promise<boolean>, чтобы компонент знал, успешно ли прошла загрузка
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

      setData(data, metadata);

      // Генерация конфигов
      const firstSheet = data[0];
      const headers = firstSheet.headers;
      const rows = firstSheet.rows; 

      const newConfigs: ColumnConfig[] = [];

      for (const header of headers) {
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
      
      setUploadProgress(90);
      setConfigs(newConfigs);
      setUploadProgress(100);
      
      return true; // УСПЕХ
    } catch (err) {
      console.error('Import failed:', err);
      setUploadError(err instanceof Error ? err.message : 'Ошибка загрузки');
      return false; // ОШИБКА
    } finally {
      setIsUploading(false);
    }
  }, [setData, setConfigs]);

  return {
    importFile: handleFileUpload,
    isUploading,
    error: uploadError,
    progress: uploadProgress
  };
}