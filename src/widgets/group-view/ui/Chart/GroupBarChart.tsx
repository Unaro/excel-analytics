'use client';
import { memo, useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Rectangle,
} from 'recharts';
import { Card } from '@/shared/ui/card';
import { ScrollableChart } from '@/shared/ui/scrollable-chart';
import type { VirtualMetric } from '@/shared/lib/validators';
import { getColorForValue, formatDisplayValue } from '@/shared/lib/utils/metric-colors';
import { formatCompactNumber } from '@/shared/lib/utils/format';
import { groupThresholdsByValue } from '@/shared/lib/utils/thresholds';
import { renderThresholdReferenceLines } from '@/shared/ui/threshold-marker';
import type { CustomBarShapeProps } from '@/shared/lib/types/recharts';
import { METRIC_SERIES_COLORS } from '@/shared/lib/utils/chart-palette';
import { ChartTooltip } from '@/shared/ui/chart-tooltip';

interface GroupBarChartProps {
  data: Array<{ name: string; [key: string]: string | number }>;
  metricKeys: string[];
  metricNames: Record<string, string>;
  title: string;
  metricConfigs?: VirtualMetric[];
  /** Код → имя (словарь): для подписей оси/тултипа. Позиция — по сырому name. */
  resolveLabel?: (label: string) => string;
  /** Палитра цветов метрик-серий. По умолчанию — METRIC_SERIES_COLORS. */
  palette?: string[];
}

export const GroupBarChart = memo(function GroupBarChart({
  data,
  metricKeys,
  metricNames,
  title,
  metricConfigs,
  resolveLabel,
  palette = METRIC_SERIES_COLORS,
}: GroupBarChartProps) {
  const displayLabel = (v: unknown) =>
    resolveLabel ? resolveLabel(String(v)) : String(v);
  const groupedThresholds = useMemo(
    () => groupThresholdsByValue(metricConfigs || [], metricKeys),
    [metricConfigs, metricKeys]
  );

  if (data.length === 0) return null;

  return (
    <Card className="p-6">
      <h3 className="font-bold text-slate-900 dark:text-white mb-4">{title}</h3>
      <ScrollableChart
        slotCount={data.length}
        slotWidth={Math.max(48, metricKeys.length * 28)}
        height={400}
      >
          <ComposedChart data={data} margin={{ top: 20, left: 20, right: 60, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
            <XAxis
              dataKey="name"
              tickFormatter={displayLabel}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(val: number) => formatCompactNumber(val)}
            />
            <Tooltip
              content={(props) => {
                const { active, payload, label } = props;
                if (!active || !payload || !payload.length) return null;
                const rows = payload.map((entry) => {
                  const vm = metricConfigs?.find(v => v.id === entry.dataKey);
                  return {
                    color: entry.color ?? '#6366f1',
                    name: metricNames[String(entry.dataKey)],
                    value: typeof entry.value === 'number'
                      ? formatDisplayValue(entry.value, vm?.displayFormat, vm?.unit)
                      : String(entry.value ?? '—'),
                  };
                });
                return <ChartTooltip title={displayLabel(label)} rows={rows} />;
              }}
              cursor={{ fill: 'var(--tooltip-cursor)', opacity: 0.1 }}
            />
            {renderThresholdReferenceLines(groupedThresholds)}
            {metricKeys.map((key, idx) => {
              const vm = metricConfigs?.find((v) => v.id === key);
              const rules = vm?.colorConfig?.rules;
              const defaultColor = palette[idx % palette.length];
              const style = vm?.chartStyle;

              // Метрика-линия: гладкая/ломаная (type) + сплошная/пунктир (dash).
              if (style?.kind === 'line') {
                return (
                  <Line
                    key={key}
                    type={style.curve === 'linear' ? 'linear' : 'monotone'}
                    dataKey={key}
                    name={metricNames[key]}
                    stroke={defaultColor}
                    strokeWidth={2}
                    strokeDasharray={style.dash === 'dashed' ? '6 4' : undefined}
                    isAnimationActive={true}
                    animationDuration={800}
                    dot={(props) => {
                      const { cx = 0, cy = 0, payload } = props;
                      const raw = payload?.[key];
                      const numericValue = typeof raw === 'number' ? raw : null;
                      const conditionalColor = getColorForValue(numericValue, rules);
                      const highlighted = !!conditionalColor;
                      return (
                        <circle
                          key={`${key}-${cx}-${cy}`}
                          cx={cx} cy={cy}
                          r={highlighted ? 5 : 3}
                          fill={conditionalColor || defaultColor}
                          stroke="#fff"
                          strokeWidth={highlighted ? 2 : 1}
                        />
                      );
                    }}
                  />
                );
              }

              return (
                <Bar
                  key={key}
                  dataKey={key}
                  name={metricNames[key]}
                  fill={defaultColor}
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                  isAnimationActive={true}
                  animationDuration={800}
                  shape={(props: CustomBarShapeProps) => {
                    const { x = 0, y = 0, width = 0, height = 0, value, fill } = props;
                    const numericValue = typeof value === 'number' ? value : null;
                    // value уже в масштабе отображения (данные прогнаны через
                    // toDisplayScale) — формат НЕ передаём, иначе двойной ×100.
                    const conditionalColor = getColorForValue(numericValue, rules);
                    const finalFill = conditionalColor || fill || defaultColor;
                    return (
                      <Rectangle
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        fill={finalFill}
                        radius={[4, 4, 0, 0]}
                      />
                    );
                  }}
                />
              );
            })}
          </ComposedChart>
      </ScrollableChart>
    </Card>
  );
});