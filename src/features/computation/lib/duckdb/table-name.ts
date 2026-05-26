/**
 * Генерирует детерминированное имя таблицы из datasetId.
 * 
 * Regex: /[^a-zA-Z0-9_]/g — разрешены ТОЛЬКО буквы, цифры и подчёркивание.
 * Дефис ЗАПРЕЩЁН, т.к. в DuckDB идентификаторы с дефисом требуют кавычек
 * и могут вызывать проблемы с парсером SQL.
 */
export function buildDuckDBTableName(datasetId: string): string {
  // 1. Заменяем всё, кроме [a-zA-Z0-9_], на подчёркивание
  const safeId = datasetId.replace(/[^a-zA-Z0-9_]/g, '_');
  
  // 2. Убираем подряд идущие подчёркивания
  const normalized = safeId.replace(/_+/g, '_');
  
  // 3. Убираем ведущие/концевые подчёркивания
  const trimmed = normalized.replace(/^_+|_+$/g, '');
  
  // 4. Идентификатор в SQL не может начинаться с цифры
  const finalId = /^\d/.test(trimmed) ? `d${trimmed}` : trimmed;
  
  return `dt_${finalId}`;
}