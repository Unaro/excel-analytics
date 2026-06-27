'use client';
import { memo } from 'react';
import { Calculator, Check, BarChart3, TrendingUp, AreaChart, Spline, Activity, Minus, MoreHorizontal } from 'lucide-react';
import { Card } from '@/shared/ui/card';
import { cn } from '@/shared/lib/utils';
import { formatRu } from '@/shared/lib/utils/format';
import { VirtualMetricValue } from '@/entities/metric';
import type { MetricChartStyle, MetricChartKind } from '@/shared/lib/types/chart';
import { GroupMetricConfigPopover } from '@/features/configure-group-metric';

interface GroupKpiCardProps {
  metric: VirtualMetricValue;
  isActive: boolean;
  activeIndex: number;
  totalActive: number;
  recordCount: number;
  onToggle: (id: string) => void;
  /** Текущий стиль метрики на чарте (undefined → столбец по умолчанию). */
  chartStyle?: MetricChartStyle;
  /** Сменить стиль чарта. Нет коллбэка → контрол скрыт. */
  onChartStyleChange?: (style: MetricChartStyle) => void;
  /** Группа + шаблон метрики — для редактора условного форматирования (CF). */
  groupId?: string;
  /** sourceMetricId метрики группы (ключ CF/стиля). Нет → CF-кнопка скрыта. */
  metricId?: string;
  templateId?: string;
}

/** Маленькая кнопка-переключатель стиля внутри карточки. */
function StyleToggle({
  active, title, onClick, children,
}: { active: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        'p-1 rounded transition-colors',
        active
          ? 'bg-indigo-600 text-white'
          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
      )}
    >
      {children}
    </button>
  );
}

/**
 * КЛИКАБЛЬНАЯ KPI-карточка. 
 * Активная карточка подсвечивается цветом и отображает свою позицию в активных.
 */
export const GroupKpiCard = memo(function GroupKpiCard({
  metric,
  isActive,
  activeIndex,
  totalActive,
  recordCount,
  onToggle,
  chartStyle,
  onChartStyleChange,
  groupId,
  metricId,
  templateId,
}: GroupKpiCardProps) {
  const kind = chartStyle?.kind ?? 'bar';
  const curve = chartStyle?.curve ?? 'smooth';
  const dash = chartStyle?.dash ?? 'solid';
  // line и area делят настройки кривой/штриха; bar — без них.
  const hasLineStyle = kind === 'line' || kind === 'area';
  // Переключение на line/area подставляет дефолты кривой/штриха, чтобы «помнились».
  const setKind = (k: MetricChartKind) =>
    onChartStyleChange?.(k === 'bar' ? { ...chartStyle, kind: 'bar' } : { kind: k, curve, dash });
  const setCurve = (c: 'smooth' | 'linear') =>
    onChartStyleChange?.({ kind: kind === 'area' ? 'area' : 'line', curve: c, dash });
  const setDash = (d: 'solid' | 'dashed') =>
    onChartStyleChange?.({ kind: kind === 'area' ? 'area' : 'line', curve, dash: d });
  // Цвета для активных метрик (чередуются)
  const ACTIVE_COLORS = [
    'border-indigo-400 bg-indigo-50/50 dark:border-indigo-600 dark:bg-indigo-950/30',
    'border-purple-400 bg-purple-50/50 dark:border-purple-600 dark:bg-purple-950/30',
    'border-emerald-400 bg-emerald-50/50 dark:border-emerald-600 dark:bg-emerald-950/30',
    'border-amber-400 bg-amber-50/50 dark:border-amber-600 dark:bg-amber-950/30',
    'border-rose-400 bg-rose-50/50 dark:border-rose-600 dark:bg-rose-950/30',
  ];

  return (
    <Card
      onClick={() => onToggle(metric.virtualMetricId)}
      className={cn(
        "group/th p-5 flex flex-col justify-between cursor-pointer select-none",
        "hover:shadow-md transition-all",
        isActive
          ? ACTIVE_COLORS[activeIndex % ACTIVE_COLORS.length]
          : "border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100"
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <span
          className="text-xs font-medium text-slate-600 dark:text-slate-400 line-clamp-2 h-8"
          title={metric.virtualMetricName}
        >
          {metric.virtualMetricName}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {/* Условное форматирование метрики (CF) — доступно в 1-D и 2-D. */}
          {groupId && metricId && (
            <GroupMetricConfigPopover
              groupId={groupId}
              metricId={metricId}
              metricName={metric.virtualMetricName}
              templateId={templateId}
            />
          )}
          {isActive ? (
            <>
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-white/70 dark:bg-slate-900/70 rounded-full px-1.5 py-0.5">
                #{activeIndex + 1}
              </span>
              <div className="p-1 bg-indigo-600 rounded-full">
                <Check size={10} className="text-white" />
              </div>
            </>
          ) : (
            <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-400">
              <Calculator size={12} />
            </div>
          )}
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          {metric.value === null ? <span className="text-slate-300">—</span> : metric.formattedValue}
        </div>
        {recordCount > 0 && (
          <div className="text-[10px] text-slate-400 mt-1">
            {formatRu(recordCount)} записей
          </div>
        )}
      </div>

      {onChartStyleChange && (
        <div className="mt-3 pt-2 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center gap-1">
          {/* Тип: столбец / линия */}
          <StyleToggle active={kind === 'bar'} title="Столбец" onClick={() => setKind('bar')}>
            <BarChart3 size={13} />
          </StyleToggle>
          <StyleToggle active={kind === 'line'} title="Линия" onClick={() => setKind('line')}>
            <TrendingUp size={13} />
          </StyleToggle>
          <StyleToggle active={kind === 'area'} title="Область" onClick={() => setKind('area')}>
            <AreaChart size={13} />
          </StyleToggle>

          {/* Для линии/области — стиль кривой и штрих обводки */}
          {hasLineStyle && (
            <>
              <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
              <StyleToggle active={curve === 'smooth'} title="Гладкая кривая" onClick={() => setCurve('smooth')}>
                <Spline size={13} />
              </StyleToggle>
              <StyleToggle active={curve === 'linear'} title="Ломаная (прямые)" onClick={() => setCurve('linear')}>
                <Activity size={13} />
              </StyleToggle>
              <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
              <StyleToggle active={dash === 'solid'} title="Сплошная" onClick={() => setDash('solid')}>
                <Minus size={13} />
              </StyleToggle>
              <StyleToggle active={dash === 'dashed'} title="Пунктир" onClick={() => setDash('dashed')}>
                <MoreHorizontal size={13} />
              </StyleToggle>
            </>
          )}
        </div>
      )}
    </Card>
  );
});