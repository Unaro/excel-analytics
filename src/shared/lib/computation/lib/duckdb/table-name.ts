/**
 * Генерирует детерминированное имя таблицы из datasetId.
 * 
 * Regex: /[^a-zA-Z0-9_]/g — разрешены ТОЛЬКО буквы, цифры и подчёркивание.
 */
export function buildTableName(datasetId: string): string {
  // 1. Приводим к нижнему регистру
  const lowered = datasetId.toLowerCase();
  
  // 2. Заменяем всё, кроме [a-z0-9_], на подчёркивание
  const safeId = lowered.replace(/[^a-z0-9_]/g, '_');
  
  // 3. Убираем подряд идущие подчёркивания
  const normalized = safeId.replace(/_+/g, '_');
  
  // 4. Убираем ведущие/концевые подчёркивания
  const trimmed = normalized.replace(/^_+|_+$/g, '');
  
  // 5. Идентификатор в SQL не может начинаться с цифры
  const finalId = /^\d/.test(trimmed) ? `d${trimmed}` : trimmed;
  
  return `dt_${finalId}`;
}