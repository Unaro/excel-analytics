// lib/utils/format.ts

/**
 * Форматирует число в компактной нотации ru-RU (1,2 млн, 3,4 тыс.).
 */
export function formatCompactNumber(number: number): string {
  return new Intl.NumberFormat('ru-RU', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(number);
}

/**
 * Форматирует число с разделителями разрядов ru-RU.
 */
export function formatNumber(number: number, decimals = 1): string {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: decimals,
  }).format(number);
}

/**
 * Готовит произвольное значение ячейки к отображению:
 * null/пусто → «—», boolean → ✓/✗, число → локализованная строка.
 * Возвращает display-строку и семантический тип для стилизации.
 */
export function formatDataValue(value: unknown): { display: string; type: 'number' | 'text' | 'boolean' | 'null' } {
  if (value === null || value === undefined || value === '') {
    return { display: '—', type: 'null' };
  }
  if (typeof value === 'number') {
    return {
      display: value.toLocaleString('ru-RU', { maximumFractionDigits: 4 }),
      type: 'number'
    };
  }
  if (typeof value === 'boolean') {
    return { display: value ? '✓' : '✗', type: 'boolean' };
  }
  return { display: String(value), type: 'text' };
}