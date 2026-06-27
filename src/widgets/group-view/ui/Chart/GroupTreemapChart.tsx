'use client';
import { memo } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '@/shared/ui/card';
import type { VirtualMetric } from '@/shared/lib/validators';
import { getColorForValue, formatDisplayValue } from '@/shared/lib/utils/metric-colors';
import { METRIC_SERIES_COLORS } from '@/shared/lib/utils/chart-palette';
import { ChartTooltip } from '@/shared/ui/chart-tooltip';
import type { FormattingRule } from '@/shared/lib/utils/formatting-rules';

/** Узел treemap: имя категории + значение метрики (в масштабе отображения). */
export interface TreemapDatum {
  name: string;
  value: number;
  /** Индекс-сигнатура — требование recharts TreemapDataType. */
  [key: string]: string | number;
}

interface GroupTreemapChartProps {
  /** Категории с положительными значениями (display-масштаб, как у баров). */
  data: TreemapDatum[];
  title: string;
  /** Мета метрики — формат, единица, CF-правила окраски. */
  metricConfig?: VirtualMetric;
  /** Код → имя (словарь) для подписей/тултипа. */
  resolveLabel?: (label: string) => string;
  /** Палитра цветов (цикл по категориям при отсутствии CF). */
  palette?: string[];
}

/** Пропсы кастомного узла treemap (recharts мёржит свои x/y/width/height/name/value). */
interface TreemapNodeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  name?: string;
  value?: number;
  palette: string[];
  rules?: FormattingRule[];
  format?: string;
  unit?: string;
  displayLabel: (v: unknown) => string;
}

/** Приблизительное число символов, влезающих по ширине ячейки. */
function fitText(text: string, width: number): string {
  const max = Math.max(0, Math.floor((width - 12) / 6.2));
  return text.length > max ? text.slice(0, Math.max(0, max - 1)) + '…' : text;
}

function TreemapNode(props: TreemapNodeProps) {
  const { x = 0, y = 0, width = 0, height = 0, index = 0, name = '', value = 0, palette, rules, format, unit, displayLabel } = props;
  if (width <= 0 || height <= 0) return null;
  // value уже в масштабе отображения → формат в getColorForValue НЕ передаём
  // (иначе двойной ×100), как в GroupBarChart.
  const cf = getColorForValue(typeof value === 'number' ? value : null, rules ?? undefined);
  const fill = cf || palette[index % palette.length];
  const label = displayLabel(name);
  const showLabel = width > 56 && height > 26;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#ffffff" strokeWidth={2} rx={3} />
      {showLabel && (
        <>
          <text x={x + 6} y={y + 16} fill="#ffffff" fontSize={11} fontWeight={600} style={{ pointerEvents: 'none' }}>
            {fitText(label, width)}
          </text>
          <text x={x + 6} y={y + 30} fill="#ffffff" fontSize={10} opacity={0.85} style={{ pointerEvents: 'none' }}>
            {fitText(formatDisplayValue(value, format, unit), width)}
          </text>
        </>
      )}
    </g>
  );
}

/**
 * Treemap (Фаза 4): прямоугольники-категории, площадь ∝ значению ОДНОЙ метрики.
 * Показывает доли категорий; цвет — по CF-правилам метрики (как бары) или цикл
 * палитры. Значения — в масштабе отображения (положительные; см. buildTreemapData).
 */
export const GroupTreemapChart = memo(function GroupTreemapChart({
  data,
  title,
  metricConfig,
  resolveLabel,
  palette = METRIC_SERIES_COLORS,
}: GroupTreemapChartProps) {
  const displayLabel = (v: unknown) => (resolveLabel ? resolveLabel(String(v)) : String(v));
  const format = metricConfig?.displayFormat;
  const unit = metricConfig?.unit;
  const rules = metricConfig?.colorConfig?.rules;

  if (data.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="font-bold text-slate-900 dark:text-white mb-4">{title}</h3>
        <div className="h-[360px] flex items-center justify-center text-sm text-slate-400">
          Нет положительных значений для treemap
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="font-bold text-slate-900 dark:text-white mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={400}>
        <Treemap
          data={data}
          dataKey="value"
          stroke="#ffffff"
          isAnimationActive={false}
          content={
            <TreemapNode
              palette={palette}
              rules={rules}
              format={format}
              unit={unit}
              displayLabel={displayLabel}
            />
          }
        >
          <Tooltip
            content={(props) => {
              const { active, payload } = props;
              if (!active || !payload || !payload.length) return null;
              const node = payload[0]?.payload as TreemapDatum | undefined;
              if (!node) return null;
              return (
                <ChartTooltip
                  title={displayLabel(node.name)}
                  rows={[{
                    color: getColorForValue(node.value, rules ?? undefined) || palette[0],
                    name: metricConfig?.name ?? '',
                    value: formatDisplayValue(node.value, format, unit),
                  }]}
                />
              );
            }}
          />
        </Treemap>
      </ResponsiveContainer>
    </Card>
  );
});
