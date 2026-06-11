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
 * Ключевые особенности:
 *   1. raw: true + cellDates: true — оставляем числа как числа, даты как Date
 *   2. normalizeValue ПЫТАЕТСЯ распарсить числовые строки
 *      (русский формат "1 234,56" → 1234.56)
 *   3. Excel TIME (год 1899) корректно извлекается как строка "HH:MM" или "HH:MM:SS"
 */
export function parseExcelToJson(fileBuffer: ArrayBuffer): ParsedExcel {
  const workbook = XLSX.read(fileBuffer, {
    type: 'array',
    cellDates: true,
    raw: true,
  });

  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) {
    return { flatRows: [], sheetNames: [], headers: [] };
  }

  const firstSheet = workbook.Sheets[sheetNames[0]];
  const firstRows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  const headers = (firstRows[0] as unknown[])
    ?.map((h) => (h === null || h === undefined ? '' : String(h).trim()))
    .filter((h) => h !== '') ?? [];

  const flatRows: DatasetRow[] = [];

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
      raw: true,
    });

    for (const row of rows) {
      const normalized = normalizeRow(row);
      if (isRowEmpty(normalized)) continue;
      flatRows.push(normalized);
    }
  }

  return { flatRows, sheetNames, headers };
}

function normalizeRow(row: Record<string, unknown>): DatasetRow {
  const result: DatasetRow = {};
  for (const [key, value] of Object.entries(row)) {
    result[key] = normalizeValue(value);
  }
  return result;
}

/**
 * Извлекает время из Date-объекта Excel TIME (год 1899).
 *
 * Excel хранит TIME как Date с базовой датой 1899-12-30 или 1899-12-31.
 * Например: 5 часов 3 минуты 1 секунда → 1899-12-31T05:03:01.000Z
 *
 * @returns Строка в формате "HH:MM" (если секунды нулевые) или "HH:MM:SS"
 */
function extractTimeFromDate(value: Date): string {
  const hours = String(value.getUTCHours()).padStart(2, '0');
  const minutes = String(value.getUTCMinutes()).padStart(2, '0');
  const seconds = String(value.getUTCSeconds()).padStart(2, '0');
  // Если секунды нулевые — более компактный формат
  return seconds === '00' ? `${hours}:${minutes}` : `${hours}:${minutes}:${seconds}`;
}

/**
 * Нормализует значение к примитивам DatasetRow.
 *
 * КЛЮЧЕВЫЕ ОСОБЕННОСТИ:
 *   - Числовые строки ("12345", "1 234,56") парсятся в number
 *   - Excel TIME (Date с годом 1899) → строка "HH:MM" или "HH:MM:SS"
 *   - Русские даты (15.01.2024) → ISO "2024-01-15"
 */
function normalizeValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;

  // Числа из XLSX (raw: true)
  if (typeof value === 'number') return isFinite(value) ? value : null;

  // Булевы
  if (typeof value === 'boolean') return value;

  // Даты (XLSX с cellDates: true возвращает Date)
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;

    if (value.getUTCFullYear() === 1899) {
      return extractTimeFromDate(value);
    }

    return value.toISOString().split('T')[0];
  }

  // Строки — самый сложный случай
  if (typeof value === 'string') {
    const trimmed = value.trim();

    // Пустые строки и прочерки → null
    if (
      trimmed === '' ||
      /^[-—–]+$/.test(trimmed) ||
      /^н\/?д$/i.test(trimmed) ||
      /^n\/?a$/i.test(trimmed) ||
      /^null$/i.test(trimmed) ||
      /^na$/i.test(trimmed)
    ) {
      return null;
    }

    // ─── Попытка распознать ДАТУ в распространённых форматах ───
    const dateMatch = tryParseDateString(trimmed);
    if (dateMatch !== null) return dateMatch;

    // ─── Попытка распознать ЧИСЛО (включая русский формат) ───
    // Убираем: пробелы (включая NBSP), заменяем запятую на точку
    const normalized = trimmed
      .replace(/[\s\u00A0\u202F]+/g, '') // все виды пробелов
      .replace(',', '.');

    // Регулярка для чисел: 123, -3.14, .5, 1.23e-4
    if (/^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(normalized)) {
      const num = Number(normalized);
      if (!isNaN(num) && isFinite(num)) {
        // Защита от ложных срабатываний (телефоны, индексы)
        if (Math.abs(num) < 1e12) {
          return num;
        }
      }
    }

    return trimmed;
  }

  // Fallback
  return String(value);
}

/**
 * Пытается распарсить строку как дату.
 * Поддерживает:
 *   - ISO: 2024-01-15, 2024-01-15T10:30:00
 *   - Русский: 15.01.2024, 15/01/2024
 *   - С временем: 15.01.2024 10:30
 *
 * НЕ парсит time-only строки ("01:01", "05:03:01") — они останутся строками
 * и будут классифицированы как categorical.
 *
 * @returns ISO-строка даты (YYYY-MM-DD) или null, если не дата
 */
function tryParseDateString(value: string): string | null {
  // ISO формат: 2024-01-15 или 2024-01-15T...
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const datePart = value.split('T')[0];
    const d = new Date(datePart);
    if (!isNaN(d.getTime())) return datePart;
  }

  // Русский формат: DD.MM.YYYY или DD/MM/YYYY (с опциональным временем)
  const ruMatch = value.match(
    /^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/
  );
  if (ruMatch) {
    const [, day, month, year] = ruMatch;
    const d = new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    );
    if (
      !isNaN(d.getTime()) &&
      d.getFullYear() === Number(year) &&
      d.getMonth() === Number(month) - 1 &&
      d.getDate() === Number(day)
    ) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  return null;
}

function isRowEmpty(row: DatasetRow): boolean {
  return Object.values(row).every(
    (v) => v === null || v === '' || v === undefined
  );
}

/**
 * Regex для определения строки времени (HH:MM или HH:MM:SS).
 * Используется в classifyColumn для защиты от ложных срабатываний.
 */
const TIME_STRING_REGEX = /^\d{1,2}:\d{2}(:\d{2})?$/;

/**
 * Определяет классификацию колонки по сэмплу значений.
 *
 * Эвристика:
 *   - numeric:     > 50% значений — числа (порог снижен с 0.7)
 *   - date:        > 50% значений — ISO-даты (YYYY-MM-DD)
 *   - categorical: всё остальное (включая time-строки)
 */
export function classifyColumn(
  sample: unknown[]
): 'numeric' | 'date' | 'categorical' {
  const valid = sample.filter((v) => v != null && v !== '');
  if (valid.length === 0) return 'categorical';

  // Считаем числа
  const nums = valid.filter((v) => typeof v === 'number');
  const numericRatio = nums.length / valid.length;
  if (numericRatio > 0.5) return 'numeric';

  const dates = valid.filter((v) => {
    if (typeof v !== 'string') return false;
    // Защита: time-строки типа "01:01" или "05:03:01" не являются датами
    if (TIME_STRING_REGEX.test(v)) return false;
    return /^\d{4}-\d{2}-\d{2}$/.test(v);
  });
  const dateRatio = dates.length / valid.length;
  if (dateRatio > 0.5) return 'date';

  return 'categorical';
}

// ─────────────────────────────────────────────────────────────
// Устаревшая функция для совместимости (используется в CSV-пути)
// ─────────────────────────────────────────────────────────────

/**
 * Конвертирует первый лист Excel-файла в CSV-буфер.
 *
 * @deprecated Используется только legacy CSV-путём импорта;
 * основной путь — importExcelBuffer через DuckDB.
 */
export function convertExcelToCsvBuffer(fileBuffer: ArrayBuffer): {
  csvBuffer: Uint8Array;
  sheetNames: string[];
} {
  const workbook = XLSX.read(fileBuffer, {
    type: 'array',
    cellDates: true,
    raw: false,
  });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Обработка TIME-ячеек (год 1899)
  for (const cellRef in worksheet) {
    if (cellRef.startsWith('!')) continue;
    const cell = worksheet[cellRef];
    if (cell.v instanceof Date) {
      const year = cell.v.getUTCFullYear();
      if (year === 1899) {
        const hours = String(cell.v.getUTCHours()).padStart(2, '0');
        const minutes = String(cell.v.getUTCMinutes()).padStart(2, '0');
        const seconds = String(cell.v.getUTCSeconds()).padStart(2, '0');
        const timeStr = seconds === '00'
          ? `${hours}:${minutes}`
          : `${hours}:${minutes}:${seconds}`;

        cell.t = 's';
        cell.v = timeStr;
        delete cell.w;
        delete cell.z;
      }
    }
  }

  const csvString = XLSX.utils.sheet_to_csv(worksheet, {
    FS: ',',
    RS: '\n',
    blankrows: false,
    strip: true,
    dateNF: 'yyyy-mm-dd',
  });

  return {
    csvBuffer: new TextEncoder().encode(csvString),
    sheetNames: workbook.SheetNames,
  };
}