'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { logger } from '@/shared/lib/logger';
import { buildFilePreview, type FilePreview } from '@/features/setup-dataset';
import { PgStep, SetupStep, SourceType } from './types';

export function useSetupWizard() {
  const datasets = useDatasetStore(s => s.datasets);
  const activeId = useDatasetStore(s => s.activeDatasetId);
  const isSyncing = useDatasetStore(s => s.isSyncing);

  const activeDataset = useMemo(
    () => (activeId ? datasets[activeId] : null),
    [activeId, datasets]
  );

  const hasActiveData = !!activeDataset && (activeDataset.metadata?.totalRows ?? 0) > 0;

  const [step, setStep] = useState<SetupStep>('manager');
  const [sourceType, setSourceType] = useState<SourceType>('file');
  const [pgStep, setPgStep] = useState<PgStep>('connection');
  const [pgConfig, setPgConfig] = useState<unknown>(null);

  // Выбранный, но ещё НЕ импортированный файл + его предпросмотр.
  // Пока он есть — пользователь на шаге «Импорт», авто-навигация отключена.
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Справочники (role: 'reference') в навигации визарда не считаются
  const dataDatasetCount = useMemo(
    () => Object.values(datasets).filter(ds => ds.role !== 'reference').length,
    [datasets]
  );

  // Авто-навигация при гидратации и изменении датасетов.
  // Пока выбран файл под импорт — не вмешиваемся (пользователь на шаге «Импорт»).
  useEffect(() => {
    if (selectedFile) return;
    if (activeId && !datasets[activeId]) {
      setStep(dataDatasetCount > 0 ? 'manager' : 'upload');
      return;
    }
    if (activeId && hasActiveData) {
      setStep('columns');
    } else {
      setStep(dataDatasetCount > 0 ? 'manager' : 'upload');
    }
  }, [activeId, hasActiveData, datasets, dataDatasetCount, selectedFile]);

  /** Файл выбран: строим лёгкий предпросмотр и уходим на шаг «Импорт». */
  const handleFileSelected = useCallback(async (file: File) => {
    setSelectedFile(file);
    setPreview(null);
    setPreviewLoading(true);
    setStep('import');
    try {
      const buffer = await file.arrayBuffer();
      setPreview(buildFilePreview(buffer, file.name));
    } catch (err) {
      logger.error('[SetupWizard] Не удалось построить предпросмотр:', err);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  /** Сброс выбора файла (отмена импорта / возврат к загрузке). */
  const resetSelectedFile = useCallback(() => {
    setSelectedFile(null);
    setPreview(null);
    setPreviewLoading(false);
  }, []);

  const hasMultipleDatasets = dataDatasetCount > 0;

  return {
    step,
    setStep,
    sourceType,
    setSourceType,
    pgStep,
    setPgStep,
    pgConfig,
    setPgConfig,
    datasets,
    activeId,
    activeDataset,
    isSyncing,
    hasActiveData,
    hasMultipleDatasets,
    selectedFile,
    preview,
    previewLoading,
    handleFileSelected,
    resetSelectedFile,
  };
}
