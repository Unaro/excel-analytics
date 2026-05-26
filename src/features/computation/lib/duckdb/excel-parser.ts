import * as XLSX from 'xlsx';
import type { DatasetRow } from '@/entities/dataset/model/types';

export interface ParsedSheet {
  sheetName: string;
  headers: string[];
  rows: DatasetRow[];
}

/**
 * Безопасное преобразование значения ячейки.
 * 
 * Логика:
 * - null/undefined → null
 * - Date → ISO строка (YYYY-MM-DD)
 * - boolean → boolean
 * - number (валидный) → number
 * - строка "—" / "-" / "н/д" / "" → null (явное обнуление прочерков)
 * - строка с числом (с пробелами/запятыми) → number
 * - строка с датой YYYY-MM-DD → строка (без времени)
 * - прочее → строка
 */
function parseCellValue(raw: unknown): string | number | boolean | null {
  if (raw === undefined || raw === null) return null;

  if (raw instanceof Date) {
    const iso = raw.toISOString().split('T')[0];
    return isNaN(raw.getTime()) ? null : iso;
  }

  if (typeof raw === 'number') return isFinite(raw) ? raw : null;
  if (typeof raw === 'boolean') return raw;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();

    // Пустые строки и прочерки → null
    if (trimmed === '' || /^[-—–]+$/.test(trimmed) || /^н\/?д$/i.test(trimmed)) {
      return null;
    }

    // Даты в ISO-формате
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.split('T')[0];
    }

    // Числа: убираем пробелы-разделители тысяч и заменяем запятую на точку
    const normalized = trimmed
      .replace(/\s+/g, '')          // Убираем пробелы ("1 234" → "1234")
      .replace(/\u00A0/g, '')       // Убираем неразрывные пробелы
      .replace(',', '.');           // Запятая → точка
    
    if (/^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(normalized)) {
      const num = Number(normalized);
      if (!isNaN(num) && isFinite(num)) return num;
    }

    return trimmed;
  }

  return String(raw);
}

export function parseExcelInWorker(fileBuffer: ArrayBuffer): ParsedSheet[] {
  const workbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true });

  return workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      raw: false,
    }) as unknown[][];

    if (rawRows.length === 0) return { sheetName, headers: [], rows: [] };

    const headers = (rawRows[0] as unknown[])
      .map((h) => String(h ?? '').trim())
      .filter((h) => h !== '');

    const rows: DatasetRow[] = rawRows.slice(1).map((row) => {
      const obj: DatasetRow = {};
      headers.forEach((header) => {
        obj[header] = parseCellValue(row[headers.indexOf(header)]);
      });
      return obj;
    });

    return { sheetName, headers, rows };
  });
}