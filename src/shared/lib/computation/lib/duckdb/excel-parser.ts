import * as XLSX from 'xlsx';
import type { DatasetRow } from '@/shared/lib/types/dataset';

export interface ParsedExcel {
  /** Все строки всех листов в плоском массиве */
  flatRows: DatasetRow[];
  /** Имена листов */
  sheetNames: string[];
  /** Имена колонок (из первого листа) */
  headers: string[];
}

/**
 * Парсит Excel/CSV в плоский массив JS-объектов.
 *
 * В отличие от CSV-подхода, этот путь:
 *   1. НЕ создаёт промежуточную CSV-строку (экономия ~200 МБ)
 *   2. Позволяет батчинг при вставке в DuckDB (экономия RAM)
 *   3. Возвращает заголовки для генерации ColumnConfig
 *
 * Для больших файлов (> 50k строк) используется batched Arrow insert
 * в worker.ts, что даёт пиковое потребление ~50 МБ вместо ~2 ГБ.
 */
export function parseExcelToJson(fileBuffer: ArrayBuffer): ParsedExcel {
  // raw: true — оставляем числа как числа (не конвертируем в строки для CSV)
  // cellDates: true — корректно парсим даты
  const workbook = XLSX.read(fileBuffer, {
    type: 'array',
    cellDates: true,
    raw: true,
  });

  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) {
    return { flatRows: [], sheetNames: [], headers: [] };
  }

  // Берём заголовки из первого листа
  const firstSheet = workbook.Sheets[sheetNames[0]];
  const firstRows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  const headers = (firstRows[0] as unknown[])
    ?.map((h) => (h === null || h === undefined ? '' : String(h).trim()))
    .filter((h) => h !== '') ?? [];

  // Собираем все строки всех листов в плоский массив
  const flatRows: DatasetRow[] = [];

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
      raw: true,
    });

    for (const row of rows) {
      const normalized = normalizeRow(row);
      // Пропускаем полностью пустые строки
      if (isRowEmpty(normalized)) continue;
      flatRows.push(normalized);
    }
  }

  return { flatRows, sheetNames, headers };
}

/**
 * Нормализует значения строки к примитивам DatasetRow.
 */
function normalizeRow(row: Record<string, unknown>): DatasetRow {
  const result: DatasetRow = {};
  for (const [key, value] of Object.entries(row)) {
    result[key] = normalizeValue(value);
  }
  return result;
}

function normalizeValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || /^[-—–]+$/.test(trimmed) || /^н\/?д$/i.test(trimmed)) {
      return null;
    }
    return trimmed;
  }
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString().split('T')[0];
  }
  return String(value);
}

function isRowEmpty(row: DatasetRow): boolean {
  return Object.values(row).every(
    (v) => v === null || v === '' || v === undefined
  );
}

/**
 * Определяет классификацию колонки по сэмплу значений.
 * Та же логика, что была в оригинальном worker.ts.
 */
export function classifyColumn(
  sample: unknown[]
): 'numeric' | 'date' | 'categorical' {
  const valid = sample.filter((v) => v != null && v !== '');
  if (valid.length === 0) return 'categorical';

  const nums = valid.filter((v) => typeof v === 'number');
  const ratio = nums.length / valid.length;

  if (ratio > 0.7) return 'numeric';

  // Простая эвристика дат
  const dates = valid.filter((v) => {
    if (typeof v !== 'string') return false;
    return /^\d{4}-\d{2}-\d{2}/.test(v);
  });
  if (dates.length / valid.length > 0.7) return 'date';

  return 'categorical';
}