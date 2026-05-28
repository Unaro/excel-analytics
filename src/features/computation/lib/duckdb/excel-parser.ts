import * as XLSX from 'xlsx';
import type { DatasetRow } from '@/entities/dataset/model/types';

export interface ParsedSheet {
  sheetName: string;
  headers: string[];
  rows: DatasetRow[];
}

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

    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.split('T')[0];
    }

    const normalized = trimmed
      .replace(/\s+/g, '')
      .replace(/\u00A0/g, '')
      .replace(',', '.');
    
    if (/^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(normalized)) {
      const num = Number(normalized);
      if (!isNaN(num) && isFinite(num)) return num;
    }

    return trimmed;
  }

  return String(raw);
}

function isRowEmpty(row: DatasetRow): boolean {
  return Object.values(row).every(v => v === null || v === '' || v === undefined);
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

    if (headers.length === 0) return { sheetName, headers: [], rows: [] };

    const rows: DatasetRow[] = rawRows
      .slice(1)
      .map((row) => {
        const obj: DatasetRow = {};
        headers.forEach((header, idx) => {
          obj[header] = parseCellValue(row[idx]);
        });
        return obj;
      })
      .filter(row => !isRowEmpty(row));

    return { sheetName, headers, rows };
  });
}