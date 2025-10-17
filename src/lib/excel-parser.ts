import * as XLSX from 'xlsx';
import { create, all } from 'mathjs';

const math = create(all);

export async function parseExcelFile(file: File): Promise<{
  sheetName: string;
  headers: string[];
  rows: any[];
}[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  
  const sheets = workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length === 0) {
      return { sheetName, headers: [], rows: [] };
    }
    
    const headers = jsonData[0] as string[];
    const rows = jsonData.slice(1).map((row: any) => {
      const rowObj: any = {};
      headers.forEach((header, index) => {
        rowObj[header] = row[index] ?? null;
      });
      return rowObj;
    });
    
    return { sheetName, headers, rows };
  });
  
  return sheets;
}

// Фильтрация данных по условиям
export function applyFilters(
  rows: any[],
  filters: Array<{
    column: string;
    operator: string;
    value: any;
  }>
): any[] {
  return rows.filter(row => {
    return filters.every(filter => {
      const cellValue = row[filter.column];
      const filterValue = filter.value;
      
      switch (filter.operator) {
        case '=':
          return String(cellValue).toLowerCase() === String(filterValue).toLowerCase();
        case '>':
          return parseFloat(cellValue) > parseFloat(filterValue);
        case '<':
          return parseFloat(cellValue) < parseFloat(filterValue);
        case '>=':
          return parseFloat(cellValue) >= parseFloat(filterValue);
        case '<=':
          return parseFloat(cellValue) <= parseFloat(filterValue);
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

// Вычисление формулы с использованием mathjs
export function evaluateFormula(
  formula: string,
  filteredRows: any[],
  availableColumns: string[]
): number {
  try {
    // Подготовка данных для формулы
    const scope: any = {};
    
    // Создаем массивы значений для каждой колонки
    availableColumns.forEach(column => {
      const values = filteredRows
        .map(row => {
          const val = row[column];
          return val !== null && val !== undefined ? parseFloat(val) : null;
        })
        .filter(val => val !== null && !isNaN(val as number));
      
      scope[column] = values;
    });
    
    // Добавляем агрегационные функции
    scope.SUM = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    scope.AVG = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    scope.COUNT = (arr: number[]) => arr.length;
    scope.MIN = (arr: number[]) => arr.length > 0 ? Math.min(...arr) : 0;
    scope.MAX = (arr: number[]) => arr.length > 0 ? Math.max(...arr) : 0;
    
    // Вычисляем формулу
    const result = math.evaluate(formula, scope);
    
    return typeof result === 'number' ? result : 0;
  } catch (error) {
    console.error('Ошибка вычисления формулы:', error);
    return 0;
  }
}

// Получить значение одного столбца из отфильтрованных строк
export function getColumnValues(rows: any[], column: string): number[] {
  return rows
    .map(row => parseFloat(row[column]))
    .filter(val => !isNaN(val));
}
