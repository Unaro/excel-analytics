import * as XLSX from 'xlsx';
import { create, all } from 'mathjs';

const math = create(all);

interface ExcelRow {
  [key: string]: string | number | boolean | null;
}

interface SheetData {
  sheetName: string;
  headers: string[];
  rows: ExcelRow[];
}

export async function parseExcelFile(file: File): Promise<SheetData[]> {
  const buffer = await file.arrayBuffer();
  
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  
  let workbook: XLSX.WorkBook;
  
  if (fileExtension === 'csv') {
    const text = new TextDecoder('utf-8').decode(buffer);
    workbook = XLSX.read(text, { type: 'string', raw: true });
  } else {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  }
  
  const sheets = workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as unknown[][];
    
    if (jsonData.length === 0) {
      return { sheetName, headers: [], rows: [] };
    }
    
    const headers = jsonData[0] as string[];
    const rows = jsonData.slice(1).map((row: unknown[]) => {
      const rowObj: ExcelRow = {};
      headers.forEach((header, index) => {
        const value = row[index];
        rowObj[header] = value !== undefined ? value as string | number | boolean | null : null;
      });
      return rowObj;
    });
    
    return { sheetName, headers, rows };
  });
  
  return sheets;
}

export function applyFilters(
  rows: ExcelRow[],
  filters: Array<{
    column: string;
    operator: string;
    value: string | number;
  }>
): ExcelRow[] {
  return rows.filter(row => {
    return filters.every(filter => {
      const cellValue = row[filter.column];
      const filterValue = filter.value;
      
      switch (filter.operator) {
        case '=':
          return String(cellValue).toLowerCase() === String(filterValue).toLowerCase();
        case '>':
          return parseFloat(String(cellValue)) > parseFloat(String(filterValue));
        case '<':
          return parseFloat(String(cellValue)) < parseFloat(String(filterValue));
        case '>=':
          return parseFloat(String(cellValue)) >= parseFloat(String(filterValue));
        case '<=':
          return parseFloat(String(cellValue)) <= parseFloat(String(filterValue));
        case '!=':
          return String(cellValue).toLowerCase() !== String(filterValue).toLowerCase();
        case 'contains':
          return String(cellValue).toLowerCase().includes(String(filterValue).toLowerCase());
        default:
          return true;
      }
    });
  });
}

function createSafeFieldName(fieldName: string, index: number): string {
  return `field_${index}`;
}

export function evaluateFormula(
  formula: string,
  filteredRows: ExcelRow[],
  availableColumns: string[]
): number {
  try {
    const fieldMapping: { [key: string]: string } = {};
    const reverseMapping: { [key: string]: string } = {};
    
    availableColumns.forEach((column, index) => {
      const safeName = createSafeFieldName(column, index);
      fieldMapping[column] = safeName;
      reverseMapping[safeName] = column;
    });
    
    let processedFormula = formula;
    const sortedColumns = [...availableColumns].sort((a, b) => b.length - a.length);
    
    sortedColumns.forEach(column => {
      const safeName = fieldMapping[column];
      const escapedColumn = column.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedColumn, 'g');
      processedFormula = processedFormula.replace(regex, safeName);
    });
    
    const scope: Record<string, number[] | ((arr: number[]) => number)> = {};
    
    availableColumns.forEach((column, index) => {
      const safeName = createSafeFieldName(column, index);
      const values = filteredRows
        .map(row => {
          const val = row[column];
          return val !== null && val !== undefined ? parseFloat(String(val)) : null;
        })
        .filter((val): val is number => val !== null && !isNaN(val));
      
      scope[safeName] = values;
    });
    
    scope.SUM = (arr: number[]) => {
      if (!Array.isArray(arr)) return 0;
      return arr.reduce((a, b) => a + b, 0);
    };
    
    scope.AVG = (arr: number[]) => {
      if (!Array.isArray(arr) || arr.length === 0) return 0;
      return arr.reduce((a, b) => a + b, 0) / arr.length;
    };
    
    scope.COUNT = (arr: number[]) => {
      if (!Array.isArray(arr)) return 0;
      return arr.length;
    };
    
    scope.MIN = (arr: number[]) => {
      if (!Array.isArray(arr) || arr.length === 0) return 0;
      return Math.min(...arr);
    };
    
    scope.MAX = (arr: number[]) => {
      if (!Array.isArray(arr) || arr.length === 0) return 0;
      return Math.max(...arr);
    };
    
    const result = math.evaluate(processedFormula, scope);
    
    return typeof result === 'number' ? result : 0;
  } catch (error) {
    console.error('Ошибка вычисления формулы:', error);
    console.error('Оригинальная формула:', formula);
    return 0;
  }
}

export function getColumnValues(rows: ExcelRow[], column: string): number[] {
  return rows
    .map(row => parseFloat(String(row[column])))
    .filter(val => !isNaN(val));
}
