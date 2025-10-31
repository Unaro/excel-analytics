import type { Group, Indicator } from '@/lib/data-store';

export interface IndicatorPackage {
  version: string;
  exportedAt: string;
  indicators: Indicator[];
}

export interface GroupPackage {
  version: string;
  exportedAt: string;
  groups: Group[];
}

export interface LibraryPackage {
  version: string;
  exportedAt: string;
  indicators: Indicator[];
}

// экспорт групп
export function exportGroups(groups: Group[]): GroupPackage {
  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    groups: groups.map((g) => ({
      ...g,
    })),
  };
}

// экспорт уникальных показателей из библиотеки
export function exportIndicatorsLibrary(indicators: Indicator[]): LibraryPackage {
  // Используем Map для уникальности по названию
  const uniqueMap = new Map<string, Indicator>();
  
  indicators.forEach((ind) => {
    if (!uniqueMap.has(ind.name)) {
      uniqueMap.set(ind.name, ind);
    }
  });

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    indicators: Array.from(uniqueMap.values()),
  };
}

// скачивание библиотеки JSON
export function downloadLibraryAsJSON(
  indicators: Indicator[],
  filename: string = `library-${new Date().toISOString().split('T')[0]}.json`
): void {
  const data = exportIndicatorsLibrary(indicators);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// скачивание групп JSON
export function downloadGroupsAsJSON(
  groups: Group[],
  filename: string = `groups-${new Date().toISOString().split('T')[0]}.json`
): void {
  const data = exportGroups(groups);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Валидация показателя перед экспортом
 */
export function validateIndicator(indicator: Indicator): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!indicator.name?.trim()) {
    errors.push('Название показателя отсутствует');
  }

  if (!indicator.formula?.trim()) {
    errors.push('Формула показателя отсутствует');
  }

  if (indicator.formula && !isFormulaValid(indicator.formula)) {
    errors.push('Формула содержит синтаксические ошибки');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// импорт библиотеки
export async function importLibrary(file: File): Promise<{
  success: boolean;
  indicators: Indicator[];
  errors: string[];
}> {
  const errors: string[] = [];
  const indicators: Indicator[] = [];

  try {
    const text = await file.text();
    const data = JSON.parse(text) as unknown;

    if (!isValidLibraryPackage(data)) {
      errors.push('Неверный формат файла. Ожидается LibraryPackage.');
      return { success: false, indicators, errors };
    }

    const pkg = data as LibraryPackage;

    for (const indicator of pkg.indicators) {
      const validation = validateIndicator(indicator);
      if (!validation.valid) {
        errors.push(
          `Показатель "${indicator.name}" содержит ошибки: ${validation.errors.join(', ')}`
        );
        continue;
      }
      indicators.push(indicator);
    }

    return { success: errors.length === 0, indicators, errors };
  } catch (error) {
    if (error instanceof SyntaxError) {
      errors.push(`Ошибка парсинга JSON: ${error.message}`);
    } else {
      errors.push(`Неизвестная ошибка при импорте: ${String(error)}`);
    }
    return { success: false, indicators, errors };
  }
}

// импорт групп
export async function importGroups(file: File): Promise<{
  success: boolean;
  groups: Group[];
  errors: string[];
}> {
  const errors: string[] = [];
  const groups: Group[] = [];

  try {
    const text = await file.text();
    const data = JSON.parse(text) as unknown;

    if (!isValidGroupPackage(data)) {
      errors.push('Неверный формат файла. Ожидается GroupPackage.');
      return { success: false, groups, errors };
    }

    const pkg = data as GroupPackage;

    for (const group of pkg.groups) {
      if (!group.name || !group.id) {
        errors.push('Группа должна содержать name и id');
        continue;
      }
      groups.push(group);
    }

    return { success: errors.length === 0, groups, errors };
  } catch (error) {
    if (error instanceof SyntaxError) {
      errors.push(`Ошибка парсинга JSON: ${error.message}`);
    } else {
      errors.push(`Неизвестная ошибка при импорте: ${String(error)}`);
    }
    return { success: false, groups, errors };
  }
}

// Вспомогательные функции валидации (переименованы для избежания конфликтов)
function isValidLibraryPackage(data: unknown): data is LibraryPackage {
  if (typeof data !== 'object' || data === null) return false;
  const pkg = data as Record<string, unknown>;
  return (
    typeof pkg.version === 'string' &&
    typeof pkg.exportedAt === 'string' &&
    Array.isArray(pkg.indicators)
  );
}

function isValidGroupPackage(data: unknown): data is GroupPackage {
  if (typeof data !== 'object' || data === null) return false;
  const pkg = data as Record<string, unknown>;
  return (
    typeof pkg.version === 'string' &&
    typeof pkg.exportedAt === 'string' &&
    Array.isArray(pkg.groups)
  );
}

/**
 * Простая проверка синтаксиса формулы
 */
function isFormulaValid(formula: string): boolean {
  let bracketCount = 0;
  for (const char of formula) {
    if (char === '(') bracketCount++;
    if (char === ')') bracketCount--;
    if (bracketCount < 0) return false;
  }
  return bracketCount === 0;
}

/**
 * Генерирует контрольную сумму показателя
 */
export function generateChecksum(indicator: Indicator): string {
  const data = `${indicator.name}${indicator.formula}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Экспортирует массив показателей в JSON
 */
export function exportIndicators(indicators: Indicator[]): IndicatorPackage {
  const validatedIndicators: Indicator[] = indicators
    .filter((ind) => validateIndicator(ind).valid)
    .map((ind) => ({
      ...ind,
    }));

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    indicators: validatedIndicators,
  };
}

/**
 * Экспортирует в JSON файл (запускает скачивание)
 */
export function downloadIndicatorsAsJSON(
  indicators: Indicator[],
  filename: string = 'indicators.json'
): void {
  const data = exportIndicators(indicators);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Импортирует показатели из JSON
 */
export async function importIndicators(file: File): Promise<{
  success: boolean;
  indicators: Indicator[];
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const indicators: Indicator[] = [];

  try {
    const text = await file.text();
    const data = JSON.parse(text) as unknown;

    if (!isValidPackage(data)) {
      errors.push('Неверный формат файла. Ожидается IndicatorPackage.');
      return { success: false, indicators, errors, warnings };
    }

    const pkg = data as IndicatorPackage;

    if (pkg.version !== '1.0') {
      warnings.push(`Версия пакета ${pkg.version}, может быть несовместима`);
    }

    for (const indicator of pkg.indicators) {
      const validation = validateIndicator(indicator);

      if (!validation.valid) {
        errors.push(
          `Показатель "${indicator.name}" содержит ошибки: ${validation.errors.join(', ')}`
        );
        continue;
      }

      indicators.push(indicator);
    }

    return {
      success: errors.length === 0,
      indicators,
      errors,
      warnings,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      errors.push(`Ошибка парсинга JSON: ${error.message}`);
    } else {
      errors.push(`Неизвестная ошибка при импорте: ${String(error)}`);
    }
    return { success: false, indicators, errors, warnings };
  }
}

/**
 * Проверяет валидность пакета показателей
 */
function isValidPackage(data: unknown): data is IndicatorPackage {
  if (typeof data !== 'object' || data === null) return false;

  const pkg = data as Record<string, unknown>;

  return (
    typeof pkg.version === 'string' &&
    typeof pkg.exportedAt === 'string' &&
    Array.isArray(pkg.indicators)
  );
}

/**
 * Экспортирует в CSV (для просмотра в Excel)
 */
export function downloadIndicatorsAsCSV(
  indicators: Indicator[],
  filename: string = 'indicators.csv'
): void {
  const headers = ['Название', 'Формула', 'Тип'];
  const rows = indicators.map((ind) => [
    `"${(ind.name || '').replace(/"/g, '""')}"`,
    `"${(ind.formula || '').replace(/"/g, '""')}"`,
    'standard',
  ]);

  const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
