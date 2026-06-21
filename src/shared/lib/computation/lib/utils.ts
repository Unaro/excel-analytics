import type {
  ActiveHierarchyFilter,
  VirtualMetricValue,
} from '@/shared/lib/types/computation';

/**
 * Форматирует значение метрики для отображения по displayFormat шаблона:
 * decimal/currency — локаль ru-RU, percent — ×100 со знаком %,
 * scientific — экспоненциальная запись; null → «—»; unit добавляется суффиксом.
 */
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
      // Доля → %: значение умножается на 100 (0.57 → 57%)
      const rounded = preciseRound(value * 100, decimals);
      res = `${rounded.toLocaleString('ru-RU', { maximumFractionDigits: decimals })}%`;
      break;
    }
    case 'percent_raw': {
      // Готовый процент: значение уже в процентах (57 → 57%), без умножения
      const rounded = preciseRound(value, decimals);
      res = `${rounded.toLocaleString('ru-RU', { maximumFractionDigits: decimals })}%`;
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
  const isPercent = format === 'percent' || format === 'percent_raw';
  return unit && !isPercent ? `${res} ${unit}` : res;
}

/**
 * Возвращает активный (самый глубокий) фильтр иерархии в виде
 * ActiveHierarchyFilter, либо null, если фильтры не заданы.
 */
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

/**
 * Собирает VirtualMetricValue из сырого числа: форматирование по настройкам
 * виртуальной метрики + ссылка на метрику-источник.
 */
export function buildGroupVirtualMetrics(
  virtualMetrics: ReadonlyArray<{
    id: string;
    name: string;
    displayFormat: string;
    decimalPlaces: number;
    unit?: string;
  }>,
  cfg: {
    groupId: string;
    virtualMetricBindings?: ReadonlyArray<{ virtualMetricId: string; metricId: string }>;
  },
  processed: Record<string, number | null>
): VirtualMetricValue[] {
  return virtualMetrics.map(vm => {
    const binding = cfg.virtualMetricBindings?.find(b => b.virtualMetricId === vm.id);
    if (!binding) {
      // Метрика не привязана в этой группе — пустое значение-заглушка.
      return {
        virtualMetricId: vm.id,
        virtualMetricName: vm.name,
        value: null,
        formattedValue: '—',
        sourceMetricId: '',
      };
    }
    // Алиас колонки результата: `${groupId}__${metricId}` (см. query-compiler).
    const alias = `${cfg.groupId}__${binding.metricId}`;
    const numericValue = typeof processed[alias] === 'number' ? processed[alias] : null;
    return {
      virtualMetricId: vm.id,
      virtualMetricName: vm.name,
      value: numericValue,
      formattedValue: formatValue(numericValue, vm.displayFormat, vm.decimalPlaces, vm.unit),
      sourceMetricId: binding.metricId,
    };
  });
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