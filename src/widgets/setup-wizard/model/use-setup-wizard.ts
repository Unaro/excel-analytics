'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { logger } from '@/shared/lib/logger';
import {
  buildFilePreview,
  buildCsvPreviewFromText,
  isCsvFileName,
  guessColumnTypes,
  detectDateFormat,
  readAggregateMatrix,
  CSV_PREFIX_BYTES,
  type FilePreview,
  type ImportParams,
  type DecimalSeparator,
  type AggregateMatrix,
  type AggregateLayoutConfig,
} from '@/features/setup-dataset';
import { validateConfigAgainstFile } from '@/features/setup-dataset';
import type { ColumnClassification } from '@/shared/lib/types';
import type { RawGroupsConfig } from '@/shared/lib/types/aggregate';
import { parseConfigFile, ConfigImportError } from '@/shared/lib/services';
import type { DatasetConfigExportParsed } from '@/shared/lib/validators';
import { toast } from '@/shared/ui/toast';
import { PgStep, SetupStep, SourceType, ConfigSelection } from './types';

type ConfigItemKind = 'group' | 'template' | 'dashboard';

/** Все элементы конфига включены по умолчанию (id групп/шаблонов/дашбордов). */
function defaultSelection(parsed: DatasetConfigExportParsed): ConfigSelection {
  const d = parsed.data;
  const dashboardIds = (d.dashboards ?? [])
    .map((x) => (x as { id?: unknown }).id)
    .filter((id): id is string => typeof id === 'string');
  return {
    groupIds: new Set((d.indicatorGroups ?? []).map((g) => g.id)),
    templateIds: new Set((d.metricTemplates ?? []).map((t) => t.id)),
    dashboardIds: new Set(dashboardIds),
    renames: {},
  };
}

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
  // Режим файла-агрегата (иерархия по уровням) + сырая матрица для разметки.
  // Фаза 0: только предпросмотр структуры, на импорт пока не влияет.
  const [isAggregate, setIsAggregate] = useState(false);
  const [aggregateMatrix, setAggregateMatrix] = useState<AggregateMatrix | null>(null);
  const [aggregateConfig, setAggregateConfig] = useState<AggregateLayoutConfig | null>(null);
  // Группы для СЫРЫХ данных, заданные до импорта (применяются в syncFromFile).
  const [rawGroupsConfig, setRawGroupsConfig] = useState<RawGroupsConfig | null>(null);
  // Режим «использовать готовую конфигурацию»: импорт конфига вместо ручной
  // настройки прямо на шаге 2. readyConfig — распарсенный (после Zod) конфиг.
  const [useReadyConfig, setUseReadyConfigState] = useState(false);
  const [readyConfig, setReadyConfig] = useState<DatasetConfigExportParsed | null>(null);
  const [configSelection, setConfigSelection] = useState<ConfigSelection | null>(null);
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
      // Сырая матрица для разметки агрегата (тот же буфер, без перечтения).
      setAggregateMatrix(readAggregateMatrix(buffer, file.name));
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

  /** Переключатель «использовать готовую конфигурацию»; сброс при выключении. */
  const setUseReadyConfig = useCallback((on: boolean) => {
    setUseReadyConfigState(on);
    if (!on) {
      setReadyConfig(null);
      setConfigSelection(null);
    }
  }, []);

  /** Загрузка JSON-конфига: парсинг + Zod; ошибки → toast. По умолчанию всё включено. */
  const loadReadyConfig = useCallback(async (file: File) => {
    try {
      const parsed = parseConfigFile(await file.text());
      setReadyConfig(parsed);
      setConfigSelection(defaultSelection(parsed));
      // Агрегат-конфиг сам подсказывает режим разметки.
      if (parsed.data.aggregateConfig) setIsAggregate(true);
    } catch (e) {
      const msg = e instanceof ConfigImportError ? e.message
        : e instanceof Error ? e.message : 'Не удалось прочитать конфиг';
      toast.error(msg);
    }
  }, []);

  /** Вкл/выкл элемент конфига (группа/шаблон/дашборд) в выборе. */
  const toggleConfigItem = useCallback((kind: ConfigItemKind, id: string) => {
    setConfigSelection((prev) => {
      if (!prev) return prev;
      const key = kind === 'group' ? 'groupIds' : kind === 'template' ? 'templateIds' : 'dashboardIds';
      const next = new Set(prev[key]);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...prev, [key]: next };
    });
  }, []);

  /** Переименование элемента конфига (пустое → исходное имя). */
  const renameConfigItem = useCallback((id: string, name: string) => {
    setConfigSelection((prev) => (prev ? { ...prev, renames: { ...prev.renames, [id]: name } } : prev));
  }, []);

  /** Сброс выбора файла (отмена импорта / возврат к загрузке). */
  const resetSelectedFile = useCallback(() => {
    setSelectedFile(null);
    setPreview(null);
    setImportParams(null);
    setPreviewLoading(false);
    setIsAggregate(false);
    setAggregateMatrix(null);
    setAggregateConfig(null);
    setRawGroupsConfig(null);
    setUseReadyConfigState(false);
    setReadyConfig(null);
    setConfigSelection(null);
    csvTextRef.current = null;
  }, []);

  // Сверка конфига с реальным файлом (усиленная валидация) — пересчёт при смене
  // конфига/режима/превью. Показывается как предупреждения, импорт не блокирует.
  const configValidation = useMemo(
    () =>
      readyConfig
        ? validateConfigAgainstFile(readyConfig, {
            headers: preview?.headers ?? [],
            aggregateMatrix,
            isAggregate,
          })
        : null,
    [readyConfig, preview, aggregateMatrix, isAggregate]
  );

  const hasMultipleDatasets = dataDatasetCount > 0;

  // Параметры импорта + автоопределённый формат дат (RU `15.03.2024` →
  // `%d.%m.%Y`). Считаем здесь, чтобы не дублировать в каждом сеттере типов:
  // зависит от типов колонок и сэмпла превью, пересчёт при их изменении.
  const importParamsFinal = useMemo<ImportParams | null>(() => {
    if (!importParams || !preview) return importParams;
    const dateFormat = detectDateFormat(
      preview.headers,
      preview.rows,
      importParams.columnTypes
    );
    return dateFormat ? { ...importParams, dateFormat } : importParams;
  }, [importParams, preview]);

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
    importParams: importParamsFinal,
    isAggregate,
    setIsAggregate,
    aggregateMatrix,
    aggregateConfig,
    setAggregateConfig,
    rawGroupsConfig,
    setRawGroupsConfig,
    useReadyConfig,
    setUseReadyConfig,
    readyConfig,
    configSelection,
    configValidation,
    loadReadyConfig,
    toggleConfigItem,
    renameConfigItem,
    handleFileSelected,
    setDelimiter,
    setDecimalSeparator,
    setColumnType,
    resetSelectedFile,
  };
}
