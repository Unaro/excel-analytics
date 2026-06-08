// lib/logic/type-mapper.ts
import { ColumnClassification, ColumnConfig } from '@/shared/lib/types/dataset';
import { transliterate } from '@/shared/lib/utils/translit';

/**
 * Маппинг PostgreSQL data_type → ColumnClassification
 * Покрывает целые, дробные, даты, логические и строковые типы
 */
const PG_TYPE_MAP: Record<string, ColumnClassification> = {
  // Целые
  'int2': 'numeric', 'smallint': 'numeric', 'serial2': 'numeric',
  'int4': 'numeric', 'integer': 'numeric', 'serial': 'numeric',
  'int8': 'numeric', 'bigint': 'numeric', 'bigserial': 'numeric',
  // Дробные / С плавающей точкой
  'float4': 'numeric', 'real': 'numeric',
  'float8': 'numeric', 'double precision': 'numeric',
  'numeric': 'numeric', 'decimal': 'numeric', 'money': 'numeric',
  // Даты и время
  'date': 'date',
  'timestamp': 'date', 'timestamp without time zone': 'date',
  'timestamptz': 'date', 'timestamp with time zone': 'date',
  'time': 'date', 'time without time zone': 'date',
  'timetz': 'date', 'time with time zone': 'date',
  'interval': 'date',
  // Логические
  'bool': 'categorical', 'boolean': 'categorical',
  // Строковые / Категориальные
  'varchar': 'categorical', 'character varying': 'categorical',
  'text': 'categorical', 'char': 'categorical', 'character': 'categorical',
  'uuid': 'categorical', 'json': 'categorical', 'jsonb': 'categorical',
  'xml': 'categorical', 'inet': 'categorical', 'cidr': 'categorical', 'macaddr': 'categorical',
  // Бинарные / Геометрические (игнорируем в аналитике)
  'bytea': 'ignore', 'bit': 'ignore', 'varbit': 'ignore',
  'point': 'ignore', 'line': 'ignore', 'lseg': 'ignore', 'box': 'ignore',
  'path': 'ignore', 'polygon': 'ignore', 'circle': 'ignore',
};

/**
 * Преобразует raw PostgreSQL тип в классификацию дашборда
 */
export function mapPgTypeToClassification(pgType: string): ColumnClassification {
  const normalized = pgType.toLowerCase().trim();
  
  // Прямое совпадение
  if (PG_TYPE_MAP[normalized]) return PG_TYPE_MAP[normalized];

  // Fallback по префиксам (строгие regex вместо includes)
  if (/^(smallint|int[248]|bigint|integer|serial|float[48]|real|double\sprecision|numeric|decimal|money)/i.test(normalized)) {
    return 'numeric';
  }
  if (/^(date|time|timestamp|interval)/i.test(normalized)) return 'date';
  if (/^(bool|boolean)/i.test(normalized)) return 'categorical';
  if (/^(char|text|varchar|uuid|json|xml|inet|cidr)/i.test(normalized)) return 'categorical';

  // По умолчанию считаем категориальным, а не игнорируемым
  return 'categorical';
}

/**
 * Генерирует ColumnConfig[] из метаданных таблицы PostgreSQL
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