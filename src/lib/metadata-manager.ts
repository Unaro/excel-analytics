import {
  initializeFieldTypes,
  getFieldTypes,
  saveFieldTypes,
  getFormulaFields,
  getFilterFields,
  getHierarchyFields,
} from './field-type-store';
import type { FieldInfo, FieldType } from './field-type-store';
import type { ExcelRow } from '@/types';

/**
 * МИГРАЦИЯ: Этот файл интегрирует старую систему метаданных с новой field-types системой
 */

export type ColumnDataType = 'numeric' | 'text' | 'categorical' | 'date';
export type ColumnType = 'number' | 'text' | 'mixed';

export interface ColumnMetadata {
  name: string;
  dataType: ColumnDataType;
  autoDetectedType: ColumnType;
  allowInFormulas: boolean;
  description?: string;
}

export interface DatasetMetadata {
  sheetName: string;
  columns: ColumnMetadata[];
  lastModified: number;
}

/**
 * Инициализирует fieldTypes на основе данных
 */
export function initializeMetadata(
  headers: string[],
  rows: ExcelRow[],
  sheetName: string = 'default'
): Record<string, FieldInfo> {
  return initializeFieldTypes(headers, rows);
}

/**
 * Определяет тип колонки по значениям
 */
export function detectColumnType(
  values: ReadonlyArray<string | number | boolean | null | undefined>
): ColumnType {
  const nonNullValues = values.filter(
    (v): v is string | number | boolean => v !== null && v !== undefined && v !== ''
  );

  if (nonNullValues.length === 0) return 'text';

  const numericValues = nonNullValues.filter((v) => !isNaN(parseFloat(String(v))));
  const numericRatio = numericValues.length / nonNullValues.length;

  if (numericRatio === 1) return 'number';
  if (numericRatio > 0) return 'mixed';

  return 'text';
}

/**
 * Предлагает тип данных на основе автоопределения
 */
export function suggestDataType(autoDetectedType: ColumnType): ColumnDataType {
  return autoDetectedType === 'number' ? 'numeric' : 'text';
}

/**
 * Преобразует fieldInfo в старый формат ColumnMetadata
 * Для обратной совместимости
 */
export function convertToColumnMetadata(
  fieldName: string,
  fieldInfo: FieldInfo,
  rows: ExcelRow[]
): ColumnMetadata {
  const values = rows.map((row) => row[fieldName]);
  const autoDetectedType = detectColumnType(values);

  return {
    name: fieldName,
    dataType: fieldInfo.type as ColumnDataType,
    autoDetectedType,
    allowInFormulas: fieldInfo.allowInFormulas,
    description: fieldInfo.description,
  };
}

/**
 * Преобразует ColumnMetadata в fieldInfo
 * Для обратной совместимости
 */
export function convertToFieldInfo(columnMetadata: ColumnMetadata): FieldInfo {
  return {
    name: columnMetadata.name,
    type: columnMetadata.dataType as FieldType,
    isInHierarchy: false,
    allowInFormulas: columnMetadata.allowInFormulas,
    isVisible: true,
    description: columnMetadata.description,
  };
}

/**
 * Получить колонки, доступные для формул
 * Использует новую систему fieldTypes
 */
export function getFormulaAllowedColumns(headers: string[]): string[] {
  const fieldTypes = getFieldTypes();
  return getFormulaFields(headers, fieldTypes);
}

/**
 * Получить колонки, доступные для фильтров
 * Использует новую систему fieldTypes
 */
export function getFilterAllowedColumns(headers: string[]): string[] {
  const fieldTypes = getFieldTypes();
  return getFilterFields(headers, fieldTypes);
}

/**
 * Получить все метаданные полей (новая система)
 */
export function getAllFieldMetadata(): Record<string, FieldInfo> {
  return getFieldTypes();
}

/**
 * Сохранить метаданные поля
 */
export function saveFieldMetadata(fieldName: string, fieldInfo: FieldInfo): void {
  const fieldTypes = getFieldTypes();
  const updated = { ...fieldTypes, [fieldName]: fieldInfo };
  saveFieldTypes(updated);
}

/**
 * Обновить тип колонки
 */
export function updateColumnType(columnName: string, newType: ColumnDataType): void {
  const fieldTypes = getFieldTypes();
  const fieldInfo = fieldTypes[columnName];

  if (fieldInfo) {
    const updated = {
      ...fieldTypes,
      [columnName]: {
        ...fieldInfo,
        type: newType as FieldType,
        allowInFormulas: newType === 'numeric',
      },
    };
    saveFieldTypes(updated);
  }
}

/**
 * Получить информацию о колонке
 */
export function getColumnInfo(columnName: string): FieldInfo | null {
  const fieldTypes = getFieldTypes();
  return fieldTypes[columnName] || null;
}

/**
 * Получить колонки, используемые в иерархии
 */
export function getHierarchyColumns(headers: string[]): string[] {
  const fieldTypes = getFieldTypes();
  return getHierarchyFields(headers, fieldTypes);
}

/**
 * Получить видимые колонки
 */
export function getVisibleColumns(headers: string[]): string[] {
  const fieldTypes = getFieldTypes();
  return headers.filter((col) => fieldTypes[col]?.isVisible !== false);
}

/**
 * Получить числовые колонки для формул
 */
export function getNumericColumns(headers: string[]): string[] {
  const fieldTypes = getFieldTypes();
  return headers.filter((col) => fieldTypes[col]?.type === 'numeric');
}

/**
 * Получить категориальные колонки
 */
export function getCategoricalColumns(headers: string[]): string[] {
  const fieldTypes = getFieldTypes();
  return headers.filter((col) => fieldTypes[col]?.type === 'categorical');
}

// ===== LEGACY / DEPRECATED =====
// Эти функции оставлены для обратной совместимости, но используют новую систему

const METADATA_STORAGE_KEY = 'datasetMetadata';

/**
 * @deprecated Используйте initializeFieldTypes вместо этого
 */
export function createInitialMetadata(
  sheetName: string,
  headers: string[],
  rows: ExcelRow[]
): DatasetMetadata {
  const fieldTypes = initializeFieldTypes(headers, rows);

  const columns: ColumnMetadata[] = headers.map((header) => {
    const fieldInfo = fieldTypes[header];
    return convertToColumnMetadata(header, fieldInfo, rows);
  });

  return {
    sheetName,
    columns,
    lastModified: Date.now(),
  };
}

/**
 * @deprecated Используйте getFieldTypes() вместо этого
 */
export function getAllMetadata(): DatasetMetadata[] {
  try {
    const data = localStorage.getItem(METADATA_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Ошибка загрузки метаданных:', error);
    return [];
  }
}

/**
 * @deprecated Используйте saveFieldTypes() вместо этого
 */
export function saveMetadata(metadata: DatasetMetadata): void {
  try {
    const existing = getAllMetadata();
    const index = existing.findIndex((m) => m.sheetName === metadata.sheetName);

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

/**
 * @deprecated Используйте getFieldTypes() вместо этого
 */
export function getMetadataForSheet(sheetName: string): DatasetMetadata | null {
  const allMetadata = getAllMetadata();
  return allMetadata.find((m) => m.sheetName === sheetName) || null;
}

/**
 * Получить колонки для условных фильтров
 * (ВСЕ видимые поля, кроме используемых в иерархии)
 */
export function getConditionalFilterAllowedColumns(headers: string[]): string[] {
  const fieldTypes = getFieldTypes();
  const allHeaders = headers;
  
  return allHeaders.filter((col) => {
    const fieldInfo = fieldTypes[col];
    if (!fieldInfo) return false;
    return fieldInfo.isVisible && !fieldInfo.isInHierarchy;
  });
}