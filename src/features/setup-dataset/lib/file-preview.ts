import * as XLSX from 'xlsx';

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
const CSV_PREFIX_BYTES = 512 * 1024;
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
      truncated: buffer.byteLength > CSV_PREFIX_BYTES || parsed.length > maxRows,
    };
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
