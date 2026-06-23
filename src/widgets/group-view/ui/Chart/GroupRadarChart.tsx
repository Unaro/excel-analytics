'use client';
import { memo, useMemo } from 'react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, Legend, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card } from '@/shared/ui/card';
import { getColorForValue, formatDisplayValue } from '@/shared/lib/utils/metric-colors';
import type { VirtualMetric } from '@/shared/lib/validators';
import { groupThresholdsByValue } from '@/shared/lib/utils/thresholds';
import { autoRadarDomain } from '@/shared/lib/utils/chart-domain';
import { formatRu } from '@/shared/lib/utils/format';
import { METRIC_SERIES_COLORS as COLORS } from '@/shared/lib/utils/chart-palette';

interface GroupRadarChartProps {
  data: Array<{ name: string; [key: string]: string | number }>;
  metricKeys: string[];
  metricNames: Record<string, string>;
  title: string;
  metricConfigs?: VirtualMetric[];
  /** Код → имя (словарь): для подписей оси/тултипа. Позиция — по сырому name. */
  resolveLabel?: (label: string) => string;
}

export const GroupRadarChart = memo(function GroupRadarChart({
  data,
  metricKeys,
  metricNames,
  title,
  metricConfigs,
  resolveLabel,
}: GroupRadarChartProps) {
  const displayLabel = (v: unknown) =>
    resolveLabel ? resolveLabel(String(v)) : String(v);
  const groupedThresholds = useMemo(
    () => groupThresholdsByValue(metricConfigs || [], metricKeys),
    [metricConfigs, metricKeys]
  );

  // Авто-домен по значениям метрик И порогов вместе. Важно: пороговые
  // полигоны рисуются на той же радиальной оси, и recharts по умолчанию
  // (allowDataOverflow=false) расширяет ось под ВСЕ серии. Если считать домен
  // только по метрикам, порог вне диапазона раздувает ось → метрика <1
  // схлопывается к центру, а сам порог уходит за край и не виден. Включаем
  // пороги в расчёт — ось охватывает и то, и другое.
  const radarDomain = useMemo(() => {
    const vals: number[] = [];
    for (const row of data) {
      for (const key of metricKeys) {
        const v = row[key];
        if (typeof v === 'number') vals.push(v);
      }
    }
    for (const group of groupedThresholds) {
      if (Number.isFinite(group.y)) vals.push(group.y);
    }
    return autoRadarDomain(vals);
  }, [data, metricKeys, groupedThresholds]);

  if (data.length === 0) return null;

  return (
    <Card className="p-6">
      <h3 className="font-bold text-slate-900 dark:text-white mb-4">{title}</h3>
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={300}>
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
            <PolarGrid stroke="#94a3b8" strokeOpacity={0.3} />
            <PolarAngleAxis
              dataKey="name"
              tickFormatter={displayLabel}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
            />
            {/* tick={false}: подписи радиальной оси скрыты намеренно.
                recharts строит тики через renderTicks только при truthy tick;
                на «мелком» float-домене niceTicks плодит тики с одинаковой
                координатой → дубль ключей `tick-<radius>`. Зум задаёт domain
                (масштаб полигона), а точные значения видны в тултипе. */}
            <PolarRadiusAxis domain={radarDomain} tick={false} axisLine={false} />
            {groupedThresholds.map((group, gi) => {
              const thresholdKey = `__threshold_${gi}`;
              return (
                <Radar
                  key={`threshold-${gi}`}
                  name={`Порог: ${formatRu(group.y)}`}
                  dataKey={thresholdKey}
                  stroke={group.primaryColor}
                  strokeWidth={group.isOverlap ? 2.5 : 2}
                  strokeDasharray={group.isOverlap ? '4 2 1 2' : '6 3'}
                  fill={group.primaryColor}
                  fillOpacity={0.04}
                  isAnimationActive={false}
                  legendType="none"
                  dot={false}
                  opacity={0.85}
                />
              );
            })}
            {metricKeys.map((key, idx) => {
              const vm = metricConfigs?.find(v => v.id === key);
              const rules = vm?.colorConfig?.rules;
              const defaultColor = COLORS[idx % COLORS.length];
              return (
                <Radar
                  key={key}
                  name={metricNames[key]}
                  dataKey={key}
                  stroke={defaultColor}
                  fill={defaultColor}
                  fillOpacity={0.3}
                  isAnimationActive={true}
                  dot={(props) => {
                    const { cx = 0, cy = 0, payload } = props;
                    const rawValue = payload?.[key];
                    const numericValue = typeof rawValue === 'number' ? rawValue : null;
                    // payload уже в масштабе отображения — формат НЕ передаём.
                    const conditionalColor = getColorForValue(numericValue, rules);
                    const isHighlighted = !!conditionalColor;
                    return (
                      <circle
                        key={`dot-${key}-${cx}-${cy}`}
                        cx={cx}
                        cy={cy}
                        r={isHighlighted ? 6 : 3}
                        fill={conditionalColor || defaultColor}
                        stroke="#fff"
                        strokeWidth={isHighlighted ? 2 : 1}
                      />
                    );
                  }}
                />
              );
            })}
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
            <Tooltip
              content={(props) => {
                const { active, payload, label } = props;
                if (!active || !payload || !payload.length) return null;
                const filtered = payload.filter((p) => {
                  const key = String(p.dataKey);
                  return !key.startsWith('__threshold_');
                });
                if (filtered.length === 0) return null;
                return (
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded shadow-xl text-xs">
                    <div className="font-bold text-slate-900 dark:text-white mb-2">{displayLabel(label)}</div>
                    {filtered.map((entry, i) => {
                      const vm = metricConfigs?.find(v => v.id === entry.dataKey);
                      return (
                        <div key={i} className="flex justify-between gap-3">
                          <span style={{ color: entry.color ?? '#6366f1' }}>
                            {metricNames[String(entry.dataKey)]}
                          </span>
                          <span className="font-mono font-bold">
                            {typeof entry.value === 'number'
                              ? formatDisplayValue(entry.value, vm?.displayFormat, vm?.unit)
                              : String(entry.value ?? '—')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});