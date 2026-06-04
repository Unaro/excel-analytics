'use client';
import { useState, useMemo, memo, useRef, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
  ReferenceLine, Label, Rectangle
} from 'recharts';
import { Card } from '@/shared/ui/card';
import { BarChart3, Hexagon, Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { formatCompactNumber } from '@/shared/lib/utils/format';
import { DashboardComputationResult } from '@/entities/metric';
import { VirtualMetric } from '@/shared/lib/validators';
import { checkRule } from '@/shared/lib/utils/metric-colors';
import type { FormattingRule, ConditionOperator, MetricColor } from '@/entities/dashboard';
import { GroupedThreshold, groupThresholdsByValue } from '@/features/computation/lib/threshold-utils';
import { useHoverPopup } from './useHoverPopup';
import { ThresholdPopup, ThresholdRuleEntry } from './ThresholdPopup';

interface ChartsSectionProps {
  result: DashboardComputationResult;
}

type ChartType = 'bar' | 'radar';

const CHART_COLORS = [
  '#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#3b82f6',
];

// ═══════════════════════════════════════════════════════════
// МАППИНГИ И ХЕЛПЕРЫ ДЛЯ ПОРОГОВ
// ═══════════════════════════════════════════════════════════
const METRIC_COLOR_HEX: Record<MetricColor, string> = {
  emerald: '#10b981',
  rose:    '#f43f5e',
  amber:   '#f59e0b',
  blue:    '#3b82f6',
  indigo:  '#6366f1',
  slate:   '#94a3b8',
};

function getOperatorLabel(op: ConditionOperator): string {
  switch (op) {
    case '>': return '>';
    case '>=': return '≥';
    case '<': return '<';
    case '<=': return '≤';
    case '==': return '=';
    case '!=': return '≠';
    case 'between': return '↔';
    default: return op;
  }
}

/**
 * Возвращает HEX-цвет правила, под которое попадает значение, или null.
 */
function getColorForValue(
  value: number | null | undefined,
  rules: FormattingRule[] | undefined
): string | null {
  if (value == null || !rules || rules.length === 0) return null;
  for (const rule of rules) {
    if (checkRule(value, rule.operator, rule.value, rule.value2)) {
      return METRIC_COLOR_HEX[rule.color] || null;
    }
  }
  return null;
}


// ═══════════════════════════════════════════════════════════
// КАСТОМНЫЙ LABEL: компактный маркер + hover-popup
// ═══════════════════════════════════════════════════════════
function ThresholdLabel({
  viewBox, value, group,
}: {
  viewBox?: { x: number; y: number; width: number; height: number };
  value: number;
  group: GroupedThreshold;
}) {
  const { isOpen, show, hide } = useHoverPopup();
  const markerRef = useRef<SVGGElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const handleEnter = useCallback(() => {
    if (markerRef.current) {
      setAnchorRect(markerRef.current.getBoundingClientRect());
    }
    show();
  }, [show]);

  if (!viewBox) return null;

  const x = viewBox.x + viewBox.width - 8;
  const y = viewBox.y;
  const formattedValue = value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });

  return (
    <>
      <g
        ref={markerRef}
        onMouseEnter={handleEnter}
        onMouseLeave={hide}
        style={{ cursor: 'pointer' }}
      >
        <g transform={`translate(${x}, ${y})`}>
          <circle cx={-4} cy={-4} r={group.isOverlap ? 5 : 3.5}
                  fill={group.primaryColor} stroke="#fff" strokeWidth={1.5} />
          <text x={-12} y={0} textAnchor="end" fontSize={9} fontWeight={600}
                fill={group.primaryColor} style={{ fontFamily: 'ui-monospace, monospace' }}>
            {formattedValue}
          </text>
          {group.isOverlap && (
            <>
              <rect x={2} y={-11} width={18} height={14} rx={7} fill={group.primaryColor} />
              <text x={11} y={-1} textAnchor="middle" fontSize={8} fontWeight={700} fill="#fff">
                +{group.rules.length - 1}
              </text>
            </>
          )}
        </g>
      </g>

      {/* ПОРТАЛ: рендерится в body, игнорирует overflow SVG и Card */}
      <ThresholdPopup
        anchorRect={anchorRect}
        thresholdValue={value}
        rules={group.rules as ThresholdRuleEntry[]}
        open={isOpen}
        placement="left"
        onMouseEnter={show}
        onMouseLeave={hide}
      />
    </>
  );
}
// ═══════════════════════════════════════════════════════════
// ЛЕГЕНДА ПОРОГОВЫХ ЗНАЧЕНИЙ
// ═══════════════════════════════════════════════════════════
function LegendItem({ group }: { group: GroupedThreshold }) {
  const { isOpen, show, hide } = useHoverPopup();
  const itemRef = useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const handleEnter = () => {
    if (itemRef.current) setAnchorRect(itemRef.current.getBoundingClientRect());
    show();
  };

  const color = group.primaryColor;
  const firstRule = group.rules[0];
  const opLabel = getOperatorLabel(firstRule.rule.operator);
  const text = firstRule.rule.operator === 'between' && firstRule.rule.value2 != null
    ? `${firstRule.rule.value} – ${firstRule.rule.value2}`
    : `${opLabel} ${firstRule.rule.value}`;

  return (
    <>
      <div
        ref={itemRef}
        onMouseEnter={handleEnter}
        onMouseLeave={hide}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border cursor-pointer transition-all hover:scale-105 hover:shadow-sm"
        style={{
          borderColor: `${color}60`,
          color,
          backgroundColor: `${color}12`,
        }}
      >
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="font-semibold truncate max-w-[100px]">{firstRule.metricName}:</span>
        <span className="font-medium">{text}</span>
        {group.isOverlap && (
          <span className="ml-1 px-1 py-0.5 rounded-full text-[8px] font-bold text-white"
                style={{ backgroundColor: color }}
                title={`+${group.rules.length - 1} правил`}>
            +{group.rules.length - 1}
          </span>
        )}
      </div>

      {group.isOverlap && (
        <ThresholdPopup
          anchorRect={anchorRect}
          thresholdValue={group.y}
          rules={group.rules as ThresholdRuleEntry[]}
          open={isOpen}
          placement="top"
          onMouseEnter={show}
          onMouseLeave={hide}
        />
      )}
    </>
  );
}

function ThresholdLegend({
  virtualMetrics, activeMetricIds,
}: {
  virtualMetrics: VirtualMetric[];
  activeMetricIds: string[];
}) {
  const groupedThresholds = useMemo(
    () => groupThresholdsByValue(virtualMetrics, activeMetricIds),
    [virtualMetrics, activeMetricIds]
  );

  if (groupedThresholds.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-1 py-1 mb-1">
      {groupedThresholds.map((group, i) => (
        <LegendItem key={`legend-${i}`} group={group} />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════
interface ChartDataItem {
  name: string;
  [key: string]: string | number;
}

interface RechartsTooltipPayload {
  name: string;
  value?: number;
  color?: string;
  payload: ChartDataItem;
  dataKey: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: RechartsTooltipPayload[];
  label?: string;
  metricNames: Record<string, string>;
}

function CustomTooltip({ active, payload, label, metricNames }: CustomTooltipProps) {
  if (active && payload && payload.length > 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-lg shadow-xl text-sm z-50 animate-in fade-in zoom-in-95">
        <p className="font-bold text-slate-900 dark:text-white mb-2 max-w-[200px] truncate border-b border-slate-100 dark:border-slate-800 pb-1">
          {label}
        </p>
        <div className="space-y-1.5">
          {payload.map((entry) => {
            const metricId = entry.dataKey;
            const metricName = metricNames[metricId] || entry.name;
            const formattedValue = entry.payload[`${metricId}_formatted`];
            return (
              <div key={metricId} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-slate-500 dark:text-slate-400 text-xs">{metricName}:</span>
                <span className="font-mono font-medium text-slate-900 dark:text-slate-200 ml-auto">
                  {typeof formattedValue === 'string' ? formattedValue : entry.value}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
// ПРОПСЫ ЧАРТОВ: добавлены virtualMetrics
// ═══════════════════════════════════════════════════════════
interface ChartComponentProps {
  data: ChartDataItem[];
  activeMetricIds: string[];
  metricNames: Record<string, string>;
  axisColor: string;
  virtualMetrics: VirtualMetric[];
  isTimeSeries?: boolean;
}

// ═══════════════════════════════════════════════════════════
// BAR CHART: использует сгруппированные пороги
// ═══════════════════════════════════════════════════════════
const MemoizedBarChart = memo(function BarChartComp({
  data,
  activeMetricIds,
  metricNames,
  axisColor,
  virtualMetrics,
  isTimeSeries
}: ChartComponentProps) {
  // Группируем пороги один раз при изменении данных
  const groupedThresholds = useMemo(
    () => groupThresholdsByValue(virtualMetrics, activeMetricIds),
    [virtualMetrics, activeMetricIds]
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 60, left: 20, bottom: 70 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={axisColor} strokeOpacity={0.2} />
        {/* ... XAxis, YAxis, Tooltip без изменений ... */}
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: axisColor }}
          axisLine={false}
          tickLine={false}
          angle={isTimeSeries ? 0 : -13}
          textAnchor="middle"
          interval={0}
          height={60}
          padding={{ left: 10, right: 10 }}
          tickMargin={24}
          type={isTimeSeries ? 'number' : 'category'}
          domain={isTimeSeries ? ['auto', 'auto'] : undefined}
          scale={isTimeSeries ? 'time' : undefined}
          tickFormatter={isTimeSeries ? (val: number) => new Date(val).toLocaleDateString('ru-RU') : undefined}
        />
        <YAxis
          tick={{ fontSize: 10, fill: axisColor }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(val: number) => formatCompactNumber(val)}
          width={75}
          tickMargin={5}
        />
        <Tooltip
          content={<CustomTooltip metricNames={metricNames} />}
          cursor={{ fill: 'var(--tooltip-cursor)', opacity: 0.1 }}
        />

        {/* ─────────────────────────────────────────────────────
            СГРУППИРОВАННЫЕ ПОРОГОВЫЕ ЛИНИИ
            Каждая линия = группа близких правил
            ───────────────────────────────────────────────────── */}
        {groupedThresholds.map((group, gi) => (
          <ReferenceLine
            key={`threshold-${gi}`}
            y={group.y}
            stroke={group.primaryColor}
            strokeDasharray={group.isOverlap ? '4 2 1 2' : '6 3'}
            strokeWidth={group.isOverlap ? 2 : 1.5}
            opacity={0.7}
            ifOverflow="extendDomain"
          >
            <Label
              content={(props: any) => (
                <ThresholdLabel
                  viewBox={props.viewBox}
                  value={group.y}
                  group={group}
                />
              )}
            />
          </ReferenceLine>
        ))}

        {/* Бары с условным окрашиванием — БЕЗ ИЗМЕНЕНИЙ */}
        {activeMetricIds.map((metricId, index) => {
          const vm = virtualMetrics.find(v => v.id === metricId);
          const rules = vm?.colorConfig?.rules;
          const defaultColor = CHART_COLORS[index % CHART_COLORS.length];

          return (
            <Bar
              key={metricId}
              dataKey={metricId}
              name={metricNames[metricId]}
              fill={defaultColor}
              radius={[4, 4, 0, 0]}
              isAnimationActive={true}
              animationDuration={800}
              shape={(props: any) => {
                const { x, y, width, height, value, fill } = props;
                const conditionalColor = getColorForValue(
                  typeof value === 'number' ? value : null,
                  rules
                );
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
      </BarChart>
    </ResponsiveContainer>
  );
});

// ═══════════════════════════════════════════════════════════
// RADAR CHART: условное окрашивание точек (dot)
// ═══════════════════════════════════════════════════════════
const MemoizedRadarChart = memo(function RadarChartComp({
  data,
  activeMetricIds,
  metricNames,
  axisColor,
  virtualMetrics,
}: ChartComponentProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
        <PolarGrid stroke={axisColor} strokeOpacity={0.2} />
        <PolarAngleAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: axisColor }}
        />
        <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
        {activeMetricIds.map((metricId, index) => {
          const vm = virtualMetrics.find(v => v.id === metricId);
          const rules = vm?.colorConfig?.rules;
          const color = CHART_COLORS[index % CHART_COLORS.length];
          return (
            <Radar
              key={metricId}
              name={metricNames[metricId]}
              dataKey={metricId}
              stroke={color}
              fill={color}
              fillOpacity={0.3}
              isAnimationActive={true}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                const value = payload?.[metricId];
                const conditionalColor = getColorForValue(
                  typeof value === 'number' ? value : null,
                  rules
                );
                const isHighlighted = !!conditionalColor;
                return (
                  <circle
                    key={`dot-${metricId}-${cx}-${cy}`}
                    cx={cx}
                    cy={cy}
                    r={isHighlighted ? 6 : 3}
                    fill={conditionalColor || color}
                    stroke="#fff"
                    strokeWidth={isHighlighted ? 2 : 1}
                  >
                    {/* Нативный SVG tooltip при наведении */}
                    {isHighlighted && (
                      <title>
                        {`${metricNames[metricId]}: ${typeof value === 'number' ? value.toLocaleString('ru-RU') : '—'}`}
                      </title>
                    )}
                  </circle>
                );
              }}
            />
          );
        })}
        <Tooltip content={<CustomTooltip metricNames={metricNames} />} />
        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
      </RadarChart>
    </ResponsiveContainer>
  );
});

// ═══════════════════════════════════════════════════════════
// ROOT COMPONENT
// ═══════════════════════════════════════════════════════════
export function ChartsSection({ result }: ChartsSectionProps) {
  const [activeMetricIds, setActiveMetricIds] = useState<string[]>(
    result.virtualMetrics.length > 0 ? [result.virtualMetrics[0].id] : []
  );
  const [chartType, setChartType] = useState<ChartType>('bar');

  const toggleMetric = (id: string) => {
    setActiveMetricIds(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter(item => item !== id);
      } else {
        if (prev.length >= 5) return prev;
        return [...prev, id];
      }
    });
  };

  const metricNames = useMemo(() => {
    const map: Record<string, string> = {};
    result.virtualMetrics.forEach(vm => {
      map[vm.id] = vm.name;
    });
    return map;
  }, [result.virtualMetrics]);

  const chartData = useMemo<ChartDataItem[]>(() => {
    if (!result || activeMetricIds.length === 0) return [];
    return result.groups.map(group => {
      const dataItem: ChartDataItem = { name: group.groupName };
      activeMetricIds.forEach(metricId => {
        const val = group.virtualMetrics.find(vm => vm.virtualMetricId === metricId);
        dataItem[metricId] = val?.value ?? 0;
        dataItem[`${metricId}_formatted`] = val?.formattedValue ?? '—';
      });
      return dataItem;
    });
  }, [result, activeMetricIds]);

  if (!result || result.groups.length === 0) return null;
  const axisColor = "#94a3b8";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[500px]">
      {/* Левая колонка: выбор метрик */}
      <Card className="p-5 lg:col-span-1 flex flex-col gap-4 lg:h-full order-2 lg:order-1">
        <div className="flex justify-between items-center lg:block">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white mb-1">Визуализация</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 hidden lg:block">
              Выберите показатели (макс 5).
            </p>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg shrink-0 lg:w-full lg:mt-4">
            <button
              onClick={() => setChartType('bar')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                chartType === 'bar' ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm" : "text-slate-500 dark:text-slate-400"
              )}
            >
              <BarChart3 size={16} /> <span className="hidden sm:inline">Столбцы</span>
            </button>
            <button
              onClick={() => setChartType('radar')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                chartType === 'radar' ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-sm" : "text-slate-500 dark:text-slate-400"
              )}
            >
              <Hexagon size={16} /> <span className="hidden sm:inline">Радар</span>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-1 max-h-[150px] lg:max-h-none">
          {result.virtualMetrics.map((vm) => {
            const isSelected = activeMetricIds.includes(vm.id);
            const colorIndex = activeMetricIds.indexOf(vm.id);
            const color = colorIndex >= 0 ? CHART_COLORS[colorIndex % CHART_COLORS.length] : undefined;
            const hasRules = (vm.colorConfig?.rules?.length ?? 0) > 0;
            return (
              <button
                key={vm.id}
                onClick={() => toggleMetric(vm.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors border select-none",
                  isSelected
                    ? "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-500 dark:text-slate-500"
                )}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn("w-2.5 h-2.5 rounded-full transition-all", isSelected ? "scale-100" : "scale-0 opacity-0")}
                    style={{ backgroundColor: color }}
                  />
                  <span>{vm.name}</span>
                  {/* Индикатор наличия пороговых правил */}
                  {hasRules && (
                    <span className="text-[8px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold uppercase">
                      Пороги
                    </span>
                  )}
                </div>
                {isSelected && <Check size={14} className="text-slate-400" />}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Правая колонка: чарт */}
      <Card className="p-4 lg:p-6 lg:col-span-2 h-[350px] lg:h-full flex flex-col bg-white dark:bg-slate-900 overflow-hidden order-1 lg:order-2">
        {/* Легенда пороговых значений */}
        <ThresholdLegend
          virtualMetrics={result.virtualMetrics}
          activeMetricIds={activeMetricIds}
        />
        <div className="w-full h-full pt-2 flex-1">
          {chartType === 'bar' ? (
            <MemoizedBarChart
              data={chartData}
              activeMetricIds={activeMetricIds}
              metricNames={metricNames}
              axisColor={axisColor}
              virtualMetrics={result.virtualMetrics}
            />
          ) : (
            <MemoizedRadarChart
              data={chartData}
              activeMetricIds={activeMetricIds}
              metricNames={metricNames}
              axisColor={axisColor}
              virtualMetrics={result.virtualMetrics}
            />
          )}
        </div>
      </Card>
    </div>
  );
}