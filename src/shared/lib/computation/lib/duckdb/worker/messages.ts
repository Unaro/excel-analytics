// Контракт сообщений DuckDB-воркера (типы запросов main → worker).
// Вынесено из прежнего worker.ts при разбиении на каталог; index.ts
// ре-экспортирует публичные типы (ImportParseOptions) для manager/sync-engine.

import type { ClientComputeParams } from '../../types';

export interface RegisterArrowPayload {
  datasetId: string;
  buffer: Uint8Array;
}

export interface ComputePayload {
  params: ClientComputeParams;
}

export interface ImportParseOptions {
  /** Разделитель колонок CSV. */
  delimiter: string;
  /** Десятичный разделитель чисел. */
  decimalSeparator: '.' | ',';
  /** Тип каждой колонки по имени; categorical/ignore → читать как VARCHAR
   *  (сохраняет коды с ведущими нулями). */
  columnTypes: Record<string, string>;
  /** strptime-формат дат для read_csv_auto (напр. `%d.%m.%Y` для RU-дат);
   *  undefined — полагаемся на авто-детект (ISO). */
  dateFormat?: string;
}

export interface ImportExcelPayload {
  datasetId: string;
  fileName: string;
  buffer: ArrayBuffer;
  /** Явные параметры разбора (шаг «Импорт»). Есть → CSV идёт нативным
   *  путём read_csv_auto (без SheetJS). Нет → прежний путь. */
  parseOptions?: ImportParseOptions;
}

export interface GetPreviewPayload {
  datasetId: string;
  limit: number;
}

export interface ExportArrowPayload {
  datasetId: string;
}

export interface DropTablePayload {
  datasetId: string;
}

export interface PingPayload {
  datasetId?: string;
}

export interface CheckTablePayload {
  datasetId: string;
}

export interface ReloadArrowPayload {
  datasetId: string;
  buffer: Uint8Array;
}

export interface CancelPayload {
  /** id COMPUTE-сообщения, результат которого больше не нужен. */
  targetId: number;
}

export interface GetColumnPairsPayload {
  datasetId: string;
  keyColumn: string;
  valueColumn: string;
}

export interface ConfigureEnginePayload {
  /** Потолок памяти DuckDB в МБ; null — снять явный лимит. */
  memoryLimitMB: number | null;
}

export type WorkerMessage =
  | { type: 'CONFIGURE_ENGINE'; id: number; payload: ConfigureEnginePayload }
  | { type: 'REGISTER_ARROW'; id: number; payload: RegisterArrowPayload }
  | { type: 'COMPUTE'; id: number; payload: ComputePayload }
  | { type: 'IMPORT_EXCEL'; id: number; payload: ImportExcelPayload }
  | { type: 'GET_PREVIEW'; id: number; payload: GetPreviewPayload }
  | { type: 'EXPORT_ARROW'; id: number; payload: ExportArrowPayload }
  | { type: 'DROP_TABLE'; id: number; payload: DropTablePayload }
  | { type: 'PING'; id: number; payload: PingPayload }
  | { type: 'CHECK_TABLE'; id: number; payload: CheckTablePayload }
  | { type: 'RELOAD_ARROW'; id: number; payload: ReloadArrowPayload }
  | { type: 'EXPORT_ARROW_CHUNKED'; id: number; payload: ExportArrowPayload }
  | { type: 'CANCEL'; id: number; payload: CancelPayload }
  | { type: 'GET_COLUMN_PAIRS'; id: number; payload: GetColumnPairsPayload };
