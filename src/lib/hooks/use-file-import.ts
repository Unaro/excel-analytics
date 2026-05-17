'use client';

import { useState, useCallback, useRef } from 'react';
import { syncFromFile } from '@/entities/dataset';
import { toast } from '@/shared/ui/toast';

export interface UseFileImportReturn {
  importFile: (file: File) => Promise<boolean>;
  isUploading: boolean;
  error: string | null;
  progress: number;
}

export function useFileImport(): UseFileImportReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  

  const uploadInProgressRef = useRef<boolean>(false);

  const handleFileUpload = useCallback(async (file: File): Promise<boolean> => {
    if (isUploading) {
      toast.warning('Загрузка уже выполняется', { id: 'upload-progress' });
      return false;
    }
    
    const toastId = 'file-import-' + Date.now();
    toast.loading('Обработка файла...', toastId);
    
    try {
      const res = await syncFromFile(file);
      
      if (res.success) {
        toast.success(`Датасет "${file.name}" загружен`, { 
          id: toastId,
          duration: 4000 
        });
        return true;
      } else {
        toast.error(`Ошибка: ${res.error}`, { 
          id: toastId,
          duration: 6000,
          action: { label: 'Повторить', onClick: () => handleFileUpload(file) }
        });
        return false;
      }
    } catch (err) {
      toast.error('Непредвиденная ошибка при загрузке', { 
        id: toastId,
        duration: 6000 
      });
      return false;
    }
  }, [isUploading]);

  return {
    importFile: handleFileUpload,
    isUploading,
    error: uploadError,
    progress: uploadProgress
  };
}