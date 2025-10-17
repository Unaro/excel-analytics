import { ColumnMetadata, DatasetMetadata, ColumnDataType } from '@/types';

const METADATA_STORAGE_KEY = 'datasetMetadata';

// Автоматическое определение типа данных
export function detectColumnType(values: any[]): 'number' | 'text' | 'mixed' {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
  
  if (nonNullValues.length === 0) return 'text';
  
  const numericValues = nonNullValues.filter(v => !isNaN(parseFloat(v)));
  const numericRatio = numericValues.length / nonNullValues.length;
  
  if (numericRatio === 1) return 'number';
  if (numericRatio > 0) return 'mixed';
  return 'text';
}

// Предложение типа данных на основе автоопределения
export function suggestDataType(autoDetectedType: 'number' | 'text' | 'mixed'): ColumnDataType {
  if (autoDetectedType === 'number') return 'numeric';
  return 'text';
}

// Сохранение метаданных
export function saveMetadata(metadata: DatasetMetadata): void {
  try {
    const existing = getAllMetadata();
    const index = existing.findIndex(m => m.sheetName === metadata.sheetName);
    
    if (index >= 0) {
      existing[index] = metadata;
    } else {
      existing.push(metadata);
    }
    
    localStorage.setItem(METADATA_STORAGE_KEY, JSON.stringify(existing));
  } catch (error) {
    console.error('Ошибка сохранения метаданных:', error);
  }
}

// Получение всех метаданных
export function getAllMetadata(): DatasetMetadata[] {
  try {
    const data = localStorage.getItem(METADATA_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Ошибка загрузки метаданных:', error);
    return [];
  }
}

// Получение метаданных для конкретного листа
export function getMetadataForSheet(sheetName: string): DatasetMetadata | null {
  const allMetadata = getAllMetadata();
  return allMetadata.find(m => m.sheetName === sheetName) || null;
}

// Создание начальных метаданных из данных
export function createInitialMetadata(
  sheetName: string,
  headers: string[],
  rows: any[]
): DatasetMetadata {
  const columns: ColumnMetadata[] = headers.map((header) => {
    const values = rows.map(row => row[header]);
    const autoDetectedType = detectColumnType(values);
    const suggestedType = suggestDataType(autoDetectedType);
    
    return {
      name: header,
      dataType: suggestedType,
      autoDetectedType,
      allowInFormulas: autoDetectedType === 'number',
    };
  });
  
  return {
    sheetName,
    columns,
    lastModified: Date.now(),
  };
}

// Обновление типа колонки
export function updateColumnType(
  sheetName: string,
  columnName: string,
  newType: ColumnDataType
): void {
  const metadata = getMetadataForSheet(sheetName);
  if (!metadata) return;
  
  const columnIndex = metadata.columns.findIndex(c => c.name === columnName);
  if (columnIndex < 0) return;
  
  metadata.columns[columnIndex].dataType = newType;
  metadata.columns[columnIndex].allowInFormulas = newType === 'numeric';
  metadata.lastModified = Date.now();
  
  saveMetadata(metadata);
}

// Получение списка колонок, доступных для формул
export function getFormulaAllowedColumns(sheetName: string): string[] {
  const metadata = getMetadataForSheet(sheetName);
  if (!metadata) return [];
  
  return metadata.columns
    .filter(c => c.allowInFormulas)
    .map(c => c.name);
}
