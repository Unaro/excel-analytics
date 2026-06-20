'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { logger } from '@/shared/lib/logger';
import {
  buildFilePreview,
  buildCsvPreviewFromText,
  isCsvFileName,
  guessColumnTypes,
  CSV_PREFIX_BYTES,
  type FilePreview,
  type ImportParams,
  type DecimalSeparator,
} from '@/features/setup-dataset';
import type { ColumnClassification } from '@/shared/lib/types';
import { PgStep, SetupStep, SourceType } from './types';

const DEFAULT_DECIMAL: DecimalSeparator = '.';

/** Стартовые параметры импорта из предпросмотра (разделитель + автотипы). */
function initialParams(preview: FilePreview): ImportParams {
  return {
    delimiter: preview.delimiter,
    decimalSeparator: DEFAULT_DECIMAL,
    columnTypes: guessColumnTypes(preview.headers, preview.rows, DEFAULT_DECIMAL),
  };
}

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
  const [importParams, setImportParams] = useState<ImportParams | null>(null);
  // Префикс CSV-текста для синхронного перепарсинга при смене разделителя
  // (без повторного чтения файла). Для xlsx — null.
  const csvTextRef = useRef<string | null>(null);

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
    setImportParams(null);
    setPreviewLoading(true);
    setStep('import');
    try {
      const isCsv = isCsvFileName(file.name);
      // CSV — читаем только префикс (срез File), xlsx — весь файл.
      const blob = isCsv ? file.slice(0, CSV_PREFIX_BYTES) : file;
      const buffer = await blob.arrayBuffer();
      const pv = buildFilePreview(buffer, file.name);
      if (isCsv) {
        csvTextRef.current = new TextDecoder('utf-8').decode(buffer);
      } else {
        csvTextRef.current = null;
      }
      setPreview(pv);
      setImportParams(initialParams(pv));
    } catch (err) {
      logger.error('[SetupWizard] Не удалось построить предпросмотр:', err);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  /** Сменить разделитель колонок CSV: синхронный перепарсинг + перегадывание типов. */
  const setDelimiter = useCallback((delimiter: string) => {
    const text = csvTextRef.current;
    if (text === null) return;
    const pv = buildCsvPreviewFromText(text, { delimiter });
    setPreview(pv);
    setImportParams((prev) => ({
      delimiter,
      decimalSeparator: prev?.decimalSeparator ?? DEFAULT_DECIMAL,
      columnTypes: guessColumnTypes(
        pv.headers,
        pv.rows,
        prev?.decimalSeparator ?? DEFAULT_DECIMAL
      ),
    }));
  }, []);

  /** Сменить десятичный разделитель: перегадать типы (numeric зависит от него). */
  const setDecimalSeparator = useCallback((decimalSeparator: DecimalSeparator) => {
    setImportParams((prev) => {
      if (!prev || !preview) return prev;
      return {
        ...prev,
        decimalSeparator,
        columnTypes: guessColumnTypes(preview.headers, preview.rows, decimalSeparator),
      };
    });
  }, [preview]);

  /** Ручная правка типа одной колонки. */
  const setColumnType = useCallback(
    (columnName: string, type: ColumnClassification) => {
      setImportParams((prev) =>
        prev
          ? { ...prev, columnTypes: { ...prev.columnTypes, [columnName]: type } }
          : prev
      );
    },
    []
  );

  /** Сброс выбора файла (отмена импорта / возврат к загрузке). */
  const resetSelectedFile = useCallback(() => {
    setSelectedFile(null);
    setPreview(null);
    setImportParams(null);
    setPreviewLoading(false);
    csvTextRef.current = null;
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
    importParams,
    handleFileSelected,
    setDelimiter,
    setDecimalSeparator,
    setColumnType,
    resetSelectedFile,
  };
}
