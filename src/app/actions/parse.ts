'use server';
import * as XLSX from 'xlsx';
import type { SheetData, DatasetMetadata, DatasetRow, ColumnStatistics } from '@/types';

/**
 * Безопасное преобразование значения ячейки с полной поддержкой float
 */
function parseCellValue(raw: unknown): string | number | boolean | null {
  if (raw === undefined || raw === null) return null;
  if (raw instanceof Date) {
    const iso = raw.toISOString().split('T')[0];
    return isNaN(raw.getTime()) ? null : iso;
  }
  // Даты в строковом формате
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.split('T')[0];
  }
  if (typeof raw === 'number') return isFinite(raw) ? raw : null;
  if (typeof raw === 'boolean') return raw;

  const str = String(raw).trim();
  if (str === '') return null;


  const normalized = str.replace(/\s/g, '').replace(',', '.');

  if (/^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(normalized)) {
    const num = Number(normalized);
    if (!isNaN(num) && isFinite(num)) return num;
  }

  return str;
}

/**
 * SERVER ACTION: Парсинг Excel файла
 */
export async function parseExcelFile(
  fileBuffer: ArrayBuffer,
  fileName: string
): Promise<{ data: SheetData[]; metadata: DatasetMetadata }> {
  try {
    const workbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true });
    
    const data: SheetData[] = workbook.SheetNames.map((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: false }) as unknown[][];
      
      if (rawRows.length === 0) return { sheetName, headers: [], rows: [] };

      const headers = (rawRows[0] as unknown[])
        .map((h) => String(h ?? '').trim())
        .filter((h) => h !== '');

      const rows: DatasetRow[] = rawRows.slice(1).map((row) => {
        const obj: DatasetRow = {};
        headers.forEach((header, idx) => {
          obj[header] = parseCellValue(row[idx]);
        });
        return obj;
      });

      return { sheetName, headers, rows };
    });

    const metadata: DatasetMetadata = {
      sourceName: fileName,
      uploadedAt: Date.now(),
      sheetOrTableNames: workbook.SheetNames,
      totalRows: data.reduce((sum, s) => sum + s.rows.length, 0),
      totalColumns: data[0]?.headers.length ?? 0,
      sourceType: 'file'
    };

    return { data, metadata };
  } catch (error) {
    console.error('[parse] Excel parsing failed:', error);
    throw new Error('Failed to parse Excel file: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

/**
 * Сбор статистики по колонке (обновлен для float)
 */
export async function getColumnStatistics(
  data: DatasetRow[],
  columnName: string
): Promise<ColumnStatistics | null> {
  const values = data.map((r) => r[columnName]).filter((v) => v != null && v !== '');
  if (values.length === 0) return null;

  const nums = values
    .filter((v): v is number => typeof v === 'number')
    .concat(
      values.filter((v): v is string => typeof v === 'string')
        .map(v => {
          const n = Number(v.replace(',', '.'));
          return isFinite(n) ? n : null;
        })
        .filter((n): n is number => n !== null)
    );

  const strs = values.filter((v) => typeof v === 'string') as string[];
  const bools = values.filter((v) => typeof v === 'boolean');
  const unique = new Set(values.map(String));

  const stats: ColumnStatistics = {
    columnName,
    totalValues: values.length,
    nullCount: data.length - values.length,
    uniqueCount: unique.size,
    numericCount: nums.length,
    textCount: strs.length,
    booleanCount: bools.length,
    dateCount: 0,
    sampleValues: Array.from(unique).slice(0, 10),
    min: undefined, max: undefined, avg: undefined, sum: undefined, median: undefined,
  };

  if (nums.length > 0) {
    stats.min = Math.min(...nums);
    stats.max = Math.max(...nums);
    stats.sum = nums.reduce((a, b) => a + b, 0);
    stats.avg = stats.sum / nums.length;
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    stats.median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }
  return stats;
}