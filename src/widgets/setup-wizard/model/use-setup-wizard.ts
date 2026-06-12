'use client';
import { useState, useEffect, useMemo } from 'react';
import { useDatasetStore } from '@/entities/dataset';
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

  // Справочники (role: 'reference') в навигации визарда не считаются
  const dataDatasetCount = useMemo(
    () => Object.values(datasets).filter(ds => ds.role !== 'reference').length,
    [datasets]
  );

  // Авто-навигация при гидратации и изменении датасетов
  useEffect(() => {
    if (activeId && !datasets[activeId]) {
      setStep(dataDatasetCount > 0 ? 'manager' : 'upload');
      return;
    }
    if (activeId && hasActiveData) {
      setStep('columns');
    } else {
      setStep(dataDatasetCount > 0 ? 'manager' : 'upload');
    }
  }, [activeId, hasActiveData, datasets, dataDatasetCount]);

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
  };
}