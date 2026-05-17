'use client';

import { useState, useCallback, useRef } from 'react';
import { syncFromFile } from '@/entities/dataset';

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
    if (isUploading || uploadInProgressRef.current) {
      console.warn('[useFileImport] Upload already in progress, ignoring');
      return false;
    }
    
    uploadInProgressRef.current = true;
    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(10);
    
    try {
      setUploadProgress(40);
      const res = await syncFromFile(file);
      setUploadProgress(100);
      return res.success;
    } catch (err) {
      console.error('Import failed:', err);
      setUploadError(err instanceof Error ? err.message : 'Ошибка загрузки');
      return false;
    } finally {
      setIsUploading(false);
      setTimeout(() => { 
        uploadInProgressRef.current = false; 
      }, 100);
    }
  }, [isUploading]);

  return {
    importFile: handleFileUpload,
    isUploading,
    error: uploadError,
    progress: uploadProgress
  };
}