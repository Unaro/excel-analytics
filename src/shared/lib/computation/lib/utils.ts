import type {
  ActiveHierarchyFilter,
  VirtualMetricValue,
} from '@/shared/lib/types/computation';

export function formatValue(
  value: number | null,
  format: string,
  decimals: number,
  unit?: string
): string {
  if (value === null) return '—';

  const preciseRound = (num: number, d: number) =>
    Math.round((num + Number.EPSILON) * 10 ** d) / 10 ** d;

  let res: string;
  switch (format) {
    case 'decimal':
    case 'currency': {
      const rounded = preciseRound(value, decimals);
      res = rounded.toLocaleString('ru-RU', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      break;
    }
    case 'percent': {
      const rounded = preciseRound(value * 100, decimals);
      res = `${rounded}%`;
      break;
    }
    case 'scientific':
      res = value.toExponential(decimals);
      break;
    default: {
      const rounded = preciseRound(value, decimals);
      res = rounded.toLocaleString('ru-RU', { maximumFractionDigits: decimals });
    }
  }
  return unit && format !== 'percent' ? `${res} ${unit}` : res;
}

export function getActiveFilter(
  filters: {
    levelId: string;
    value: string;
    columnName: string;
    levelIndex: number;
    displayValue?: string;
  }[]
): ActiveHierarchyFilter | null {
  if (filters.length === 0) return null;
  const last = filters[filters.length - 1];
  return {
    levelName: last.columnName,
    levelId: last.levelId,
    columnName: last.columnName,
    value: last.value,
    displayValue: last.displayValue ?? last.value,
    depth: last.levelIndex,
  };
}

export function buildVirtualMetricValue(
  vm: {
    id: string;
    name: string;
    displayFormat: string;
    decimalPlaces: number;
    unit?: string;
  },
  value: number | null
): VirtualMetricValue {
  return {
    virtualMetricId: vm.id,
    virtualMetricName: vm.name,
    value,
    formattedValue: formatValue(
      value,
      vm.displayFormat,
      vm.decimalPlaces,
      vm.unit
    ),
    sourceMetricId: '',
  };
}

/**
 * Вычисляет общее количество записей из агрегированных SQL-строк.
 * `_record_count` — служебная колонка, добавляемая query-compiler'ом.
 *
 * Единый источник правды для DuckDB и PostgreSQL engine'ов.
 */
export function computeTotalRecordCount(
  sqlRows: Record<string, unknown>[]
): number {
  let total = 0;
  for (const row of sqlRows) {
    const rc = row['_record_count'];
    if (typeof rc === 'number' && isFinite(rc)) {
      total += rc;
    } else if (typeof rc === 'bigint') {
      total += Number(rc);
    }
  }
  return total;
}