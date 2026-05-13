'use client';
import { useState, useCallback } from 'react';
import { syncFromFile } from '@/entities/dataset';

export function useFileImport() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileUpload = useCallback(async (file: File): Promise<boolean> => {
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
    }
  }, []);

  return {
    importFile: handleFileUpload,
    isUploading,
    error: uploadError,
    progress: uploadProgress
  };
}