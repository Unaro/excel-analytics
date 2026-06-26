'use client';

import { useState, useCallback, useRef } from 'react';
import { syncFromFile } from './sync-engine';
import { toast } from '@/shared/ui/toast';
import type { ImportParams } from '../lib/file-preview';
import type { AggregateLayoutConfig } from '../lib/aggregate-layout';
import type { RawGroupsConfig } from '@/shared/lib/types/aggregate';

export interface UseFileImportReturn {
  /** Импортирует файл; возвращает datasetId созданного датасета или null при ошибке. */
  importFile: (file: File, params?: ImportParams, aggregate?: AggregateLayoutConfig, rawGroups?: RawGroupsConfig, opts?: { skipAutoGroups?: boolean }) => Promise<string | null>;
  isUploading: boolean;
  error: string | null;
  progress: number;
}

export function useFileImport(): UseFileImportReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  

  const uploadInProgressRef = useRef<boolean>(false);

const handleFileUpload = useCallback(async (file: File, params?: ImportParams, aggregate?: AggregateLayoutConfig, rawGroups?: RawGroupsConfig, opts?: { skipAutoGroups?: boolean }): Promise<string | null> => {
    if (isUploading) return null;

    setIsUploading(true);
    const toastId = 'file-import-' + Date.now();
    toast.loading('Чтение файла (может занять время)...', { id: toastId });

    return new Promise<string | null>((resolve) => {
      setTimeout(async () => {
        try {
          const res = await syncFromFile(file, params, aggregate, rawGroups, opts);
          if (res.success) {
            toast.success(`Датасет "${file.name}" загружен`, { id: toastId });
            resolve(res.datasetId ?? null);
          } else {
            toast.error(`Ошибка: ${res.error}`, { id: toastId });
            resolve(null);
          }
        } catch (err) {
          toast.error('Непредвиденная ошибка при загрузке', { id: toastId });
          resolve(null);
        } finally {
          setIsUploading(false);
        }
      }, 50);
    });
  }, [isUploading]);

  return {
    importFile: handleFileUpload,
    isUploading,
    error: uploadError,
    progress: uploadProgress
  };
}