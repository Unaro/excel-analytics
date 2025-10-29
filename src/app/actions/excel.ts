'use server';

import * as XLSX from 'xlsx';

interface ParsedSheet {
  sheetName: string;
  headers: string[];
  rows: Record<string, string | number>[];
}

// Проверка, является ли строка пустой
function isEmptyRow(row: Record<string, string | number>, headers: string[]): boolean {
  return headers.every(header => {
    const value = row[header];
    if (value === undefined || value === null) return true;
    const strValue = String(value).trim();
    return strValue === '' || strValue === 'null' || strValue === 'undefined';
  });
}

// Очистка значения
function cleanValue(value: unknown): string | number {
  if (value === null || value === undefined) return '';
  
  const strValue = String(value).trim();
  
  if (strValue === '' || strValue === 'null' || strValue === 'undefined') {
    return '';
  }
  
  const numValue = Number(strValue);
  if (!isNaN(numValue) && strValue !== '') {
    return numValue;
  }
  
  return strValue;
}

export async function parseExcel(file: File): Promise<ParsedSheet[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'array',
      cellDates: true,
      cellNF: false,
      cellText: false,
    });

    const sheets: ParsedSheet[] = [];

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      
      // Конвертируем в JSON с опцией blankrows
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        defval: '',
        blankrows: false, // ЗДЕСЬ правильное место для этой опции
      });

      if (jsonData.length === 0) return;

      const headers = Object.keys(jsonData[0] as Record<string, unknown>);
      
      const rows = jsonData
        .map((row) => {
          const cleanedRow: Record<string, string | number> = {};
          headers.forEach((header) => {
            cleanedRow[header] = cleanValue((row as Record<string, unknown>)[header]);
          });
          return cleanedRow;
        })
        .filter((row) => !isEmptyRow(row, headers));

      if (rows.length > 0) {
        sheets.push({
          sheetName,
          headers,
          rows,
        });
      }
    });

    return sheets;
  } catch (error) {
    console.error('Error parsing Excel:', error);
    throw new Error('Не удалось прочитать Excel файл');
  }
}

export async function parseCSV(file: File): Promise<ParsedSheet[]> {
  try {
    const text = await file.text();
    
    const workbook = XLSX.read(text, { 
      type: 'string',
      raw: true,
    });

    const sheets: ParsedSheet[] = [];

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        defval: '',
        blankrows: false, // ЗДЕСЬ правильное место
      });

      if (jsonData.length === 0) return;

      const headers = Object.keys(jsonData[0] as Record<string, unknown>);
      
      const rows = jsonData
        .map((row) => {
          const cleanedRow: Record<string, string | number> = {};
          headers.forEach((header) => {
            cleanedRow[header] = cleanValue((row as Record<string, unknown>)[header]);
          });
          return cleanedRow;
        })
        .filter((row) => !isEmptyRow(row, headers));

      if (rows.length > 0) {
        sheets.push({
          sheetName: sheetName || 'Sheet1',
          headers,
          rows,
        });
      }
    });

    return sheets;
  } catch (error) {
    console.error('Error parsing CSV:', error);
    throw new Error('Не удалось прочитать CSV файл');
  }
}
