import * as XLSX from 'xlsx';
import type { ColumnClassification } from '@/shared/lib/types';

/** Десятичный разделитель чисел в исходном файле. */
export type DecimalSeparator = '.' | ',';

/** Параметры разбора, выбранные пользователем на шаге «Импорт». */
export interface ImportParams {
  /** Разделитель колонок (CSV); null — xlsx. */
  delimiter: string | null;
  /** Десятичный разделитель чисел. */
  decimalSeparator: DecimalSeparator;
  /** Тип каждой колонки по имени (numeric/date/categorical/ignore). */
  columnTypes: Record<string, ColumnClassification>;
  /**
   * Формат дат в стиле strptime для нативного CSV (`read_csv_auto`).
   * Задаётся, когда date-колонки записаны в нероссийском для DuckDB виде
   * (напр. `15.03.2024` → `%d.%m.%Y`); для ISO (`2024-03-15`) не нужен —
   * автодетект DuckDB справляется. undefined — формат не навязываем.
   */
  dateFormat?: string;
}

/**
 * Лёгкий предпросмотр файла ДО тяжёлого импорта.
 *
 * Читает только первые строки (CSV — префикс буфера, xlsx — `sheetRows`),
 * чтобы показать пользователю таблицу и дать настроить параметры разбора
 * (разделитель, типы колонок) до полной загрузки в DuckDB. Значения здесь —
 * «как в файле» (строки), без нормализации: нормализация/типизация решается
 * на шаге импорта по выбранным параметрам.
 */
export interface FilePreview {
  /** Источник распознан как текстовый CSV/TSV (иначе — бинарный xlsx). */
  isCsv: boolean;
  /** Применённый разделитель (только CSV); null — xlsx. */
  delimiter: string | null;
  /** Определённый разделитель строк (только CSV); null — xlsx. */
  newline: '\r\n' | '\n' | '\r' | null;
  /** Имена колонок (первая строка). */
  headers: string[];
  /** Первые строки данных (без заголовка), значения как строки. */
  rows: string[][];
  /** Есть ли строки за пределами предпросмотра (приблизительно). */
  truncated: boolean;
}

export interface FilePreviewOptions {
  /** Явный разделитель для CSV; если не задан — автодетект. */
  delimiter?: string;
  /** Сколько строк данных показывать (без заголовка). */
  maxRows?: number;
}

const DEFAULT_PREVIEW_ROWS = 50;
/** Сколько байт CSV читаем под предпросмотр (хватает на десятки строк). */
export const CSV_PREFIX_BYTES = 512 * 1024;
/** Кандидаты разделителей в порядке проверки. */
const CANDIDATE_DELIMITERS = [',', ';', '\t', '|'] as const;

/** Файл считается CSV/текстом по расширению (всё, что не xlsx/xls). */
export function isCsvFileName(fileName: string): boolean {
  return !/\.(xlsx|xls)$/i.test(fileName);
}

/**
 * Определяет разделитель по строке заголовка: берём кандидата с наибольшим
 * числом вхождений вне кавычек. По умолчанию — запятая.
 */
export function detectDelimiter(headerLine: string): string {
  let best = ',';
  let bestCount = -1;
  for (const delim of CANDIDATE_DELIMITERS) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < headerLine.length; i++) {
      const ch = headerLine[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === delim && !inQuotes) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = delim;
    }
  }
  return best;
}

/**
 * Определяет разделитель строк по первому переводу строки:
 * `\r\n` (Windows), `\n` (Unix) или `\r` (классический Mac).
 */
export function detectLineEnding(text: string): '\r\n' | '\n' | '\r' {
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\r') return text[i + 1] === '\n' ? '\r\n' : '\r';
    if (ch === '\n') return '\n';
  }
  return '\n';
}

/**
 * Разбирает первые `maxRows` строк CSV-текста с учётом кавычек, экранирования
 * (`""` внутри поля) и любых разделителей строк (`\n`, `\r\n`, `\r`).
 * Возвращает массив строк-ячеек (включая заголовок).
 */
export function parseCsvPreview(
  text: string,
  delimiter: string,
  maxRows: number
): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let done = false;

  // +1 на заголовок: набрав достаточно строк, останавливаемся.
  const pushRow = () => {
    row.push(field);
    rows.push(row);
    row = [];
    field = '';
    if (rows.length >= maxRows + 1) done = true;
  };

  for (let i = 0; i < text.length && !done; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      pushRow();
    } else if (ch === '\r') {
      pushRow();
      if (text[i + 1] === '\n') i++; // съедаем \n в составе \r\n
    } else {
      field += ch;
    }
  }
  // Хвост без завершающего перевода строки.
  if (!done && (field.length > 0 || row.length > 0)) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Строит предпросмотр из буфера файла. */
/**
 * Строит CSV-предпросмотр из уже декодированного текста (префикса файла).
 * Вынесено отдельно, чтобы живой перепарсинг при смене разделителя был
 * синхронным — без повторного чтения файла.
 */
export function buildCsvPreviewFromText(
  text: string,
  opts: FilePreviewOptions & { bufferTruncated?: boolean } = {}
): FilePreview {
  const maxRows = opts.maxRows ?? DEFAULT_PREVIEW_ROWS;
  const newline = detectLineEnding(text);
  // Заголовок = до первого перевода строки любого вида (\n или \r).
  const firstBreak = text.search(/[\r\n]/);
  const headerLine = firstBreak === -1 ? text : text.slice(0, firstBreak);
  const delimiter = opts.delimiter ?? detectDelimiter(headerLine);

  const parsed = parseCsvPreview(text, delimiter, maxRows);
  const headers = (parsed[0] ?? []).map((h) => h.trim());
  const rows = parsed.slice(1, maxRows + 1);
  return {
    isCsv: true,
    delimiter,
    newline,
    headers,
    rows,
    truncated: !!opts.bufferTruncated || parsed.length > maxRows,
  };
}

export function buildFilePreview(
  buffer: ArrayBuffer,
  fileName: string,
  opts: FilePreviewOptions = {}
): FilePreview {
  const maxRows = opts.maxRows ?? DEFAULT_PREVIEW_ROWS;
  const isCsv = isCsvFileName(fileName);

  if (isCsv) {
    const prefix = buffer.byteLength > CSV_PREFIX_BYTES
      ? buffer.slice(0, CSV_PREFIX_BYTES)
      : buffer;
    const text = new TextDecoder('utf-8').decode(prefix);
    return buildCsvPreviewFromText(text, {
      ...opts,
      bufferTruncated: buffer.byteLength > CSV_PREFIX_BYTES,
    });
  }

  // xlsx/xls: ограничиваем разбор первыми строками через sheetRows.
  const workbook = XLSX.read(buffer, {
    type: 'array',
    raw: true,
    cellDates: true,
    sheetRows: maxRows + 1,
  });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { isCsv: false, delimiter: null, newline: null, headers: [], rows: [], truncated: false };
  }
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });
  const headers = ((matrix[0] as unknown[]) ?? []).map((h) =>
    h === null || h === undefined ? '' : String(h).trim()
  );
  const rows = matrix.slice(1, maxRows + 1).map((r) =>
    (r as unknown[]).map((v) => (v === null || v === undefined ? '' : String(v)))
  );
  return {
    isCsv: false,
    delimiter: null,
    newline: null,
    headers,
    rows,
    truncated: matrix.length > maxRows + 1,
  };
}

/** Сырая матрица превью (без разделения заголовка) для разметки агрегата. */
export interface AggregateMatrix {
  /** Все строки (включая возможные строки шапки), значения как строки. */
  matrix: string[][];
  /** true — данные обрезаны лимитом превью. */
  truncated: boolean;
}

/**
 * Читает первые строки файла как СЫРУЮ матрицу, без предположения о шапке —
 * для детекта структуры файла-агрегата (мега-босс, фаза 0). CSV парсится по
 * разделителю, xlsx — через `sheet_to_json(header:1)` (объединённые ячейки
 * шапки приходят значением в левой ячейке, остальные пустые → forward-fill
 * в `buildColumns`).
 */
export function readAggregateMatrix(
  buffer: ArrayBuffer,
  fileName: string,
  opts: { maxRows?: number; delimiter?: string; all?: boolean } = {}
): AggregateMatrix {
  // all=true — читаем ВЕСЬ файл (импорт фазы 1), иначе только превью.
  const maxRows = opts.maxRows ?? DEFAULT_PREVIEW_ROWS;

  if (isCsvFileName(fileName)) {
    const prefix = !opts.all && buffer.byteLength > CSV_PREFIX_BYTES
      ? buffer.slice(0, CSV_PREFIX_BYTES)
      : buffer;
    const text = new TextDecoder('utf-8').decode(prefix);
    const headerLine = text.slice(0, Math.max(0, text.search(/[\r\n]/)) || text.length);
    const delimiter = opts.delimiter ?? detectDelimiter(headerLine);
    const parsed = parseCsvPreview(text, delimiter, opts.all ? Number.POSITIVE_INFINITY : maxRows);
    return {
      matrix: opts.all ? parsed : parsed.slice(0, maxRows + 1),
      truncated: !opts.all && (parsed.length > maxRows + 1 || buffer.byteLength > CSV_PREFIX_BYTES),
    };
  }

  // raw:false → берём ОТОБРАЖАЕМЫЙ текст ячейки (`.w`), а не сырое значение.
  // Иначе коды-времена вроде `8:01:06` SheetJS превращает в Date
  // (Sat Dec 30 1899 08:01:06). cellText:true (по умолчанию) генерит `.w`.
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: false,
    ...(opts.all ? {} : { sheetRows: maxRows + 2 }),
  });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { matrix: [], truncated: false };
  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });
  const sliced = opts.all ? raw : raw.slice(0, maxRows + 2);
  const matrix = sliced.map((r) =>
    (r as unknown[]).map((v) => (v === null || v === undefined ? '' : String(v)))
  );
  return { matrix, truncated: !opts.all && raw.length > maxRows + 2 };
}

// ─────────────────────────────────────────────────────────────
// Автоугадывание типа колонки по сэмплу предпросмотра
// ─────────────────────────────────────────────────────────────

const TIME_STRING_RE = /^\d{1,2}:\d{2}(:\d{2})?$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;
const RU_DATE_RE = /^\d{1,2}[./]\d{1,2}[./]\d{4}/;
const NUMBER_RE = /^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/**
 * Нормализует строку к числовому виду под выбранный десятичный разделитель.
 * Пробелы (тысячные) убираются всегда; при десятичной запятой запятая → точка.
 */
function toNumberString(raw: string, dec: DecimalSeparator): string {
  // Пробелы (обычный/NBSP/узкий) — разделители тысяч, убираем всегда.
  const s = raw.trim().replace(/[\s\u00A0\u202F]/g, '');
  // dec=',' → запятая в точку; dec='.' → запятую НЕ трогаем, значит значение
  // с запятой числом не считается (защита от 79,15 при десятичной точке).
  return dec === ',' ? s.replace(',', '.') : s;
}

/**
 * Угадывает тип колонки по сэмплу строковых значений и десятичному
 * разделителю. Эвристика: >50% чисел → numeric, >50% дат → date, иначе
 * categorical. Время вида `HH:MM` исключается из чисел/дат (это коды/время).
 * `ignore` автоматически не ставится — только вручную.
 */
export function guessColumnType(
  values: string[],
  dec: DecimalSeparator
): ColumnClassification {
  const valid = values.filter((v) => v != null && v.trim() !== '');
  if (valid.length === 0) return 'categorical';

  let nums = 0;
  let dates = 0;
  for (const v of valid) {
    const t = v.trim();
    if (TIME_STRING_RE.test(t)) continue;
    if (ISO_DATE_RE.test(t) || RU_DATE_RE.test(t)) {
      dates++;
      continue;
    }
    if (NUMBER_RE.test(toNumberString(t, dec))) nums++;
  }
  if (nums / valid.length > 0.5) return 'numeric';
  if (dates / valid.length > 0.5) return 'date';
  return 'categorical';
}

/**
 * Угадывает типы всех колонок предпросмотра: транспонирует строки по индексу
 * колонки и прогоняет `guessColumnType`. Возвращает карту имя→тип.
 */
export function guessColumnTypes(
  headers: string[],
  rows: string[][],
  dec: DecimalSeparator
): Record<string, ColumnClassification> {
  const result: Record<string, ColumnClassification> = {};
  headers.forEach((header, ci) => {
    const column = rows.map((r) => r[ci] ?? '');
    result[header] = guessColumnType(column, dec);
  });
  return result;
}

// День-месяц-год с точкой/слешем: `15.03.2024`, `1/3/2024`.
const RU_DOT_DATE_RE = /^\d{1,2}\.\d{1,2}\.\d{4}/;
const RU_SLASH_DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{4}/;

/**
 * Определяет strptime-формат date-колонок для нативного CSV (`read_csv_auto`).
 *
 * DuckDB автоматически разбирает только ISO-даты (`2024-03-15`). Российский
 * формат `15.03.2024` авто-детект оставит строкой — нужен явный `dateformat`.
 * Смотрим только на колонки, помеченные пользователем как `date`, и берём
 * формат по большинству значений (датасет однороден). ISO/смешанное →
 * undefined: формат не навязываем, чтобы не сломать авто-детект.
 */
export function detectDateFormat(
  headers: string[],
  rows: string[][],
  columnTypes: Record<string, ColumnClassification>
): string | undefined {
  let dot = 0;
  let slash = 0;
  let total = 0;
  headers.forEach((header, ci) => {
    if (columnTypes[header] !== 'date') return;
    for (const r of rows) {
      const v = (r[ci] ?? '').trim();
      if (v === '') continue;
      total++;
      if (RU_DOT_DATE_RE.test(v)) dot++;
      else if (RU_SLASH_DATE_RE.test(v)) slash++;
    }
  });
  if (total === 0) return undefined;
  if (dot / total > 0.5) return '%d.%m.%Y';
  if (slash / total > 0.5) return '%d/%m/%Y';
  return undefined;
}
