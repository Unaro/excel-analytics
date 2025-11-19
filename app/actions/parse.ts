'use server';

import * as XLSX from 'xlsx';
import type { SheetData, ExcelMetadata, ExcelRow, ColumnStatistics } from '@/types';

/**
 * Парсинг Excel файла на сервере
 * Используется в hooks/use-file-import.ts
 */
export async function parseExcelFile(
  fileBuffer: ArrayBuffer,
  fileName: string
): Promise<{ data: SheetData[]; metadata: ExcelMetadata }> {
  try {
    const workbook = XLSX.read(fileBuffer, { type: 'array' });
    
    const data: SheetData[] = workbook.SheetNames.map((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      
      // Получаем сырые данные (массив массивов)
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        defval: null,
        raw: false, // Конвертировать даты и прочее в строки для безопасности, парсим ниже
      }) as unknown[][];
      
      if (jsonData.length === 0) {
        return { sheetName, headers: [], rows: [] };
      }
      
      // Первая строка - заголовки
      const headers = (jsonData[0] as string[]).map(h => String(h).trim());
      
      // Остальные строки - данные
      const rows: ExcelRow[] = jsonData.slice(1).map((row: unknown[]) => {
        const rowObj: ExcelRow = {};
        headers.forEach((header, idx) => {
          const value = row[idx];
          
          // Очистка и базовая нормализация
          if (value === undefined || value === '' || value === null) {
            rowObj[header] = null;
          } else if (typeof value === 'string') {
            // Пытаемся преобразовать числовые строки (например "123" или "123.45")
            // Заменяем запятую на точку для корректного парсинга (ru-locale)
            const normalized = value.replace(',', '.').trim();
            if (!isNaN(Number(normalized)) && normalized !== '') {
              rowObj[header] = Number(normalized);
            } else {
              rowObj[header] = value.trim();
            }
          } else {
            rowObj[header] = null;
          }
        });
        return rowObj;
      });
      
      return { sheetName, headers, rows };
    });
    
    const metadata: ExcelMetadata = {
      fileName,
      uploadedAt: Date.now(),
      sheetNames: workbook.SheetNames,
      totalRows: data.reduce((sum, sheet) => sum + sheet.rows.length, 0),
      totalColumns: data[0]?.headers.length ?? 0,
    };
    
    return { data, metadata };
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    throw new Error('Failed to parse Excel file: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

/**
 * Получить статистику по колонке (для авто-определения типов)
 */
export async function getColumnStatistics(
  data: ExcelRow[],
  columnName: string
): Promise<ColumnStatistics | null> {
  const values = data.map(row => row[columnName]).filter(v => v != null);
  
  if (values.length === 0) {
    return null;
  }
  
  const numericValues = values.filter(v => typeof v === 'number') as number[];
  const textValues = values.filter(v => typeof v === 'string');
  const booleanValues = values.filter(v => typeof v === 'boolean');
  
  const uniqueValues = new Set(values);
  
  const statistics: ColumnStatistics = {
    columnName,
    totalValues: values.length,
    nullCount: data.length - values.length,
    uniqueCount: uniqueValues.size,
    numericCount: numericValues.length,
    textCount: textValues.length,
    booleanCount: booleanValues.length,
    dateCount: 0, 
    sampleValues: Array.from(uniqueValues).slice(0, 10),
    min: undefined,
    max: undefined,
    avg: undefined,
    sum: undefined,
    median: undefined,
  };
  
  if (numericValues.length > 0) {
    statistics.min = Math.min(...numericValues);
    statistics.max = Math.max(...numericValues);
    statistics.sum = numericValues.reduce((a, b) => a + b, 0);
    statistics.avg = statistics.sum / numericValues.length;
    
    // Медиана
    const sorted = [...numericValues].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    statistics.median = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
  
  return statistics;
}