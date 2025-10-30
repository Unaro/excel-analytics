/**
 * Хранилище для управления типами и классификацией полей
 */

export type FieldType = 'numeric' | 'categorical' | 'text' | 'date';

export interface FieldInfo {
  name: string;
  type: FieldType;
  /** Используется в иерархическом фильтре */
  isInHierarchy: boolean;
  /** Используется в формулах */
  allowInFormulas: boolean;
  /** Видимо в фильтрах и формулах */
  isVisible: boolean;
  description?: string;
}

const FIELD_TYPES_KEY = 'fieldTypes';

type FieldTypeStorage = Record<string, FieldInfo>;

/**
 * Получить все сохраненные типы полей
 */
export function getFieldTypes(): FieldTypeStorage {
  if (typeof window === 'undefined') return {};

  try {
    const data = localStorage.getItem(FIELD_TYPES_KEY);
    return data ? JSON.parse(data) as FieldTypeStorage : {};
  } catch (error) {
    console.error('Ошибка загрузки типов полей:', error);
    return {};
  }
}

/**
 * Сохранить типы полей
 */
export function saveFieldTypes(types: FieldTypeStorage): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(FIELD_TYPES_KEY, JSON.stringify(types));
  } catch (error) {
    console.error('Ошибка сохранения типов полей:', error);
  }
}

/**
 * Инициализировать типы полей для новых колонок (если их еще нет)
 * Автоматически определяет тип по названию и значениям
 */
export function initializeFieldTypes(
  allHeaders: string[],
  data: import('@/types').ExcelRow[] = []
): FieldTypeStorage {
  const currentTypes = getFieldTypes();
  const newTypes: FieldTypeStorage = { ...currentTypes };

  for (const header of allHeaders) {
    // Если уже есть - пропускаем
    if (newTypes[header]) continue;

    // Определяем тип по названию или значениям
    let type: FieldType = 'text';

    // Проверяем по названию
    const lowerName = header.toLowerCase();
    if (
      lowerName.includes('count') ||
      lowerName.includes('sum') ||
      lowerName.includes('amount') ||
      lowerName.includes('price') ||
      lowerName.includes('quantity')
    ) {
      type = 'numeric';
    } else if (
      lowerName.includes('code') ||
      lowerName.includes('id') ||
      lowerName.includes('index')
    ) {
      type = 'categorical';
    } else if (
      lowerName.includes('date') ||
      lowerName.includes('time') ||
      lowerName.includes('created')
    ) {
      type = 'date';
    }

    // Проверяем по значениям (если данные есть)
    if (data.length > 0) {
      const sampleValues = data
        .slice(0, Math.min(100, data.length))
        .map((row) => row[header])
        .filter((val) => val !== null && val !== undefined);

      if (sampleValues.length > 0) {
        const numberCount = sampleValues.filter(
          (val) => typeof val === 'number' || !isNaN(Number(val))
        ).length;
        const numberRatio = numberCount / sampleValues.length;

        if (numberRatio > 0.8) {
          type = 'numeric';
        } else if (sampleValues.every((val) => typeof val === 'string')) {
          type = 'text';
        } else {
          type = 'categorical';
        }
      }
    }

    newTypes[header] = {
      name: header,
      type,
      isInHierarchy: false,
      allowInFormulas: type === 'numeric',
      isVisible: true,
      description: undefined,
    };
  }

  saveFieldTypes(newTypes);
  return newTypes;
}

/**
 * Получить доступные поля для формул (числовые, видимые)
 */
export function getFormulaFields(
  allHeaders: string[] = [],
  fieldTypes: FieldTypeStorage = {}
): string[] {
  if (!allHeaders || allHeaders.length === 0) return [];

  return allHeaders.filter((col) => {
    const fieldInfo = fieldTypes[col];
    if (!fieldInfo) return false;
    return fieldInfo.type === 'numeric' && fieldInfo.allowInFormulas && fieldInfo.isVisible;
  });
}

/**
 * Получить доступные поля для фильтров (категориальные, видимые, не в иерархии)
 */
export function getFilterFields(
  allHeaders: string[] = [],
  fieldTypes: FieldTypeStorage = {}
): string[] {
  if (!allHeaders || allHeaders.length === 0) return [];

  return allHeaders.filter((col) => {
    const fieldInfo = fieldTypes[col];
    if (!fieldInfo) return false;
    return (
      fieldInfo.type === 'categorical' &&
      fieldInfo.isVisible &&
      !fieldInfo.isInHierarchy
    );
  });
}

/**
 * Получить поля иерархии (категориальные, в иерархии)
 */
export function getHierarchyFields(
  allHeaders: string[] = [],
  fieldTypes: FieldTypeStorage = {}
): string[] {
  if (!allHeaders || allHeaders.length === 0) return [];

  return allHeaders.filter((col) => {
    const fieldInfo = fieldTypes[col];
    if (!fieldInfo) return false;
    return fieldInfo.type === 'categorical' && fieldInfo.isInHierarchy;
  });
}

/**
 * Группировка полей по типам
 */
export function groupFieldsByType(
  fields: string[] = [],
  fieldTypes: FieldTypeStorage = {}
): Record<FieldType, string[]> {
  const grouped: Record<FieldType, string[]> = {
    numeric: [],
    categorical: [],
    text: [],
    date: [],
  };

  if (!fields || fields.length === 0) return grouped;

  for (const field of fields) {
    const info = fieldTypes[field];
    if (info) {
      grouped[info.type].push(field);
    }
  }

  return grouped;
}

export function clearFieldTypes(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(FIELD_TYPES_KEY);
  } catch (error) {
    console.error('Ошибка очистки типов полей:', error);
  }
}

export function getConditionalFilterFields(
  allHeaders: string[] = [],
  fieldTypes: FieldTypeStorage = {}
): string[] {
  if (!allHeaders || allHeaders.length === 0) return [];

  return allHeaders.filter((col) => {
    const fieldInfo = fieldTypes[col];
    if (!fieldInfo) return false;
    // Видимо И НЕ в иерархии (может быть любого типа)
    return fieldInfo.isVisible && !fieldInfo.isInHierarchy;
  });
}
