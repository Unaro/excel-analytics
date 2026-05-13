import type { ColumnClassification, ColumnConfig } from '@/types';
import { transliterate } from '@/shared/lib/utils/translit';

/**
 * Маппинг PostgreSQL data_type → ColumnClassification
 * Основан на information_schema.columns.data_type
 */
const PG_TYPE_MAP: Record<string, ColumnClassification> = {
  // Числовые
  'int2': 'numeric', 'int4': 'numeric', 'int8': 'numeric',
  'smallint': 'numeric', 'integer': 'numeric', 'bigint': 'numeric',
  'float4': 'numeric', 'float8': 'numeric', 'real': 'numeric', 'double precision': 'numeric',
  'numeric': 'numeric', 'decimal': 'numeric', 'money': 'numeric',
  
  // Даты и время
  'date': 'date', 'timestamp': 'date', 'timestamptz': 'date',
  'time': 'date', 'timetz': 'date', 'interval': 'date',
  
  // Логические
  'bool': 'categorical', 'boolean': 'categorical',
  
  // Строковые / Категориальные
  'varchar': 'categorical', 'character varying': 'categorical',
  'text': 'categorical', 'char': 'categorical', 'character': 'categorical',
  'uuid': 'categorical', 'json': 'categorical', 'jsonb': 'categorical',
  'xml': 'categorical', 'inet': 'categorical', 'cidr': 'categorical',
  
  // Бинарные / Специфические (игнорируем в аналитике)
  'bytea': 'ignore', 'bit': 'ignore', 'varbit': 'ignore',
  'point': 'ignore', 'line': 'ignore', 'lseg': 'ignore', 'box': 'ignore',
  'path': 'ignore', 'polygon': 'ignore', 'circle': 'ignore',
};

/**
 * Преобразует raw PostgreSQL тип в классификацию дашборда
 */
export function mapPgTypeToClassification(pgType: string): ColumnClassification {
  const normalized = pgType.toLowerCase().trim();
  // Прямое совпадение или поиск по префиксу (например, "timestamp without time zone")
  const exact = PG_TYPE_MAP[normalized];
  if (exact) return exact;

  // Fallback: проверяем вхождение ключевых слов
  if (normalized.includes('int') || normalized.includes('float') || normalized.includes('numeric') || normalized.includes('decimal')) return 'numeric';
  if (normalized.includes('time') || normalized.includes('date')) return 'date';
  if (normalized.includes('char') || normalized.includes('text') || normalized.includes('bool')) return 'categorical';
  
  return 'ignore';
}

/**
 * Генерирует ColumnConfig[] из метаданных таблицы PostgreSQL
 * Полностью совместим с логикой use-file-import.ts
 */
export function generateColumnConfigsFromPgSchema(
  columns: { name: string; type: string }[],
  tableName: string
): ColumnConfig[] {
  return columns.map((col, idx) => {
    const classification = mapPgTypeToClassification(col.type);
    const safeAlias = transliterate(col.name) || `col_${idx}`;
    
    return {
      columnName: col.name,
      displayName: col.name,
      alias: safeAlias,
      classification,
      description: `Авто-определено из таблицы ${tableName} (PG тип: ${col.type})`
    };
  });
}