import * as XLSX from 'xlsx';
import { create, all } from 'mathjs';

const math = create(all);

export async function parseExcelFile(file: File): Promise<{
  sheetName: string;
  headers: string[];
  rows: any[];
}[]> {
  const buffer = await file.arrayBuffer();
  
  // Определяем тип файла по расширению
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  
  let workbook: XLSX.WorkBook;
  
  if (fileExtension === 'csv') {
    // Для CSV файлов используем специальную обработку с UTF-8
    const text = new TextDecoder('utf-8').decode(buffer);
    workbook = XLSX.read(text, { type: 'string', raw: true });
  } else {
    // Для Excel файлов используем обычную обработку
    workbook = XLSX.read(buffer, { type: 'buffer' });
  }
  
  const sheets = workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    
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

// Создание безопасного имени для mathjs (только латиница)
function createSafeFieldName(fieldName: string, index: number): string {
  return `field_${index}`;
}

// Вычисление формулы с использованием mathjs
export function evaluateFormula(
  formula: string,
  filteredRows: any[],
  availableColumns: string[]
): number {
  try {
    // Создаем маппинг: реальное имя -> безопасное имя
    const fieldMapping: { [key: string]: string } = {};
    const reverseMapping: { [key: string]: string } = {};
    
    availableColumns.forEach((column, index) => {
      const safeName = createSafeFieldName(column, index);
      fieldMapping[column] = safeName;
      reverseMapping[safeName] = column;
    });
    
    // Заменяем реальные названия полей на безопасные в формуле
    let processedFormula = formula;
    
    // Сортируем по длине (от большего к меньшему), чтобы избежать частичных совпадений
    const sortedColumns = [...availableColumns].sort((a, b) => b.length - a.length);
    
    sortedColumns.forEach(column => {
      const safeName = fieldMapping[column];
      // Экранируем специальные символы в названии колонки для регулярного выражения
      const escapedColumn = column.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedColumn, 'g');
      processedFormula = processedFormula.replace(regex, safeName);
    });
    
    // Подготовка данных для формулы
    const scope: any = {};
    
    // Создаем массивы значений для каждой колонки с безопасными именами
    availableColumns.forEach((column, index) => {
      const safeName = createSafeFieldName(column, index);
      const values = filteredRows
        .map(row => {
          const val = row[column];
          return val !== null && val !== undefined ? parseFloat(val) : null;
        })
        .filter(val => val !== null && !isNaN(val as number));
      
      scope[safeName] = values;
    });
    
    // Добавляем агрегационные функции
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
    
    // Вычисляем формулу
    const result = math.evaluate(processedFormula, scope);
    
    return typeof result === 'number' ? result : 0;
  } catch (error) {
    console.error('Ошибка вычисления формулы:', error);
    console.error('Оригинальная формула:', formula);
    return 0;
  }
}

// Получить значение одного столбца из отфильтрованных строк
export function getColumnValues(rows: any[], column: string): number[] {
  return rows
    .map(row => parseFloat(row[column]))
    .filter(val => !isNaN(val));
}
