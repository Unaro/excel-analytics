'use client';

import { useCallback, useMemo } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Settings, Plus } from 'lucide-react';
import { useDashboardStore } from '@/entities/dashboard';
import { useMetricTemplateStore } from '@/entities/metric';
import { cn } from '@/shared/lib/utils';
import { nanoid } from 'nanoid';
import { DragDropList } from '@/shared/ui/drag-drop-list';
import { RuleCard } from '../../shared/ui/rule-card/ui/RuleCard';
import { FormattingRule } from '@/shared/lib/utils/formatting-rules';
import type { ColorConfig } from '@/shared/lib/types/dashboard';

interface MetricConfigPopoverProps {
  dashboardId: string;
  metricId: string;
}

/**
 * Popover для настройки условного форматирования метрики.
 * 
 * Использует @radix-ui/react-popover для автоматического позиционирования,
 * портала, collision detection и accessibility.
 * 
 * Внутри — DragDropList для переупорядочивания правил (порядок = приоритет).
 */
export function MetricConfigPopover({ dashboardId, metricId }: MetricConfigPopoverProps) {
  // Правильный селектор без useCallback
  const metric = useDashboardStore((state) => {
    const dashboard = state.dashboards.find(d => d.id === dashboardId);
    return dashboard?.virtualMetrics.find(m => m.id === metricId);
  });

  const updateMetric = useDashboardStore((s) => s.updateVirtualMetric);
  const setTemplateColorConfig = useMetricTemplateStore((s) => s.setTemplateColorConfig);

  // CF — единый источник на шаблоне; colorConfig колонки остаётся фолбэком
  // для немигрированных колонок (правила «переедут» при первой правке).
  const templateId = metric?.templateId;
  const templateColorConfig = useMetricTemplateStore(
    (s) => (templateId ? s.templates.find((t) => t.id === templateId)?.colorConfig : undefined)
  );
  const currentColorConfig = useMemo(
    () => templateColorConfig ?? metric?.colorConfig,
    [templateColorConfig, metric?.colorConfig]
  );
  const rules = useMemo(() => currentColorConfig?.rules || [], [currentColorConfig?.rules]);

  // Запись: в шаблон (единый источник), иначе — в колонку дашборда (фолбэк).
  const commit = useCallback(
    (colorConfig: ColorConfig) => {
      if (templateId) setTemplateColorConfig(templateId, colorConfig);
      else updateMetric(dashboardId, metricId, { colorConfig });
    },
    [templateId, setTemplateColorConfig, updateMetric, dashboardId, metricId]
  );

  const addRule = useCallback(() => {
    const newRule: FormattingRule = {
      id: nanoid(),
      operator: '>',
      value: 0,
      color: 'emerald',
    };
    commit({ rules: [...(currentColorConfig?.rules || []), newRule] });
  }, [commit, currentColorConfig]);

  const removeRule = useCallback((ruleId: string) => {
    commit({ rules: (currentColorConfig?.rules || []).filter(r => r.id !== ruleId) });
  }, [commit, currentColorConfig]);

  const duplicateRule = useCallback((rule: FormattingRule) => {
    commit({ rules: [...(currentColorConfig?.rules || []), { ...rule, id: nanoid() }] });
  }, [commit, currentColorConfig]);

  const updateRule = useCallback((ruleId: string, updates: Partial<FormattingRule>) => {
    commit({
      rules: (currentColorConfig?.rules || []).map(r =>
        r.id === ruleId ? { ...r, ...updates } : r
      ),
    });
  }, [commit, currentColorConfig]);

  const reorderRules = useCallback((newOrder: FormattingRule[]) => {
    commit({ rules: newOrder });
  }, [commit]);

  if (!metric) return null;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'p-1 rounded-md transition-colors',
            'opacity-0 group-hover/th:opacity-100 focus:opacity-100',
            'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400',
            'data-[state=open]:bg-indigo-100 data-[state=open]:text-indigo-600 data-[state=open]:opacity-100'
          )}
          aria-label="Настройки условного форматирования"
        >
          <Settings size={14} />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={5}
          collisionPadding={10}
          className={cn(
            'w-[350px] flex flex-col max-h-[420px]',
            'bg-white dark:bg-slate-900 rounded-xl shadow-2xl',
            'border border-gray-200 dark:border-slate-700',
            // 'origin-[--radix-popover-content-transform-origin]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            // 'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            // 'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
            'z-[49]'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ─── Header ─── */}
          <div className="p-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 rounded-t-xl flex justify-between items-center shrink-0">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Условное форматирование
            </h4>
            <button
              onClick={addRule}
              className="text-indigo-600 hover:text-indigo-700 text-xs font-medium flex items-center gap-1 transition-colors"
              type="button"
            >
              <Plus size={14} /> Добавить
            </button>
          </div>

          {/* ─── Rules List ─── */}
          <div className="p-2 overflow-y-auto custom-scrollbar flex-1 min-h-[100px]">
            {rules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                <Settings size={24} className="opacity-20" />
                <span className="text-sm">Нет правил</span>
              </div>
            ) : (
              <DragDropList<FormattingRule>
                items={rules}
                onReorder={reorderRules}
                renderItem={(props) => (
                  <RuleCard
                    {...props}
                    onUpdate={updateRule}
                    onRemove={removeRule}
                    onDuplicate={duplicateRule}
                  />
                )}
                className="space-y-2"
                dragDelay={0}
              />
            )}
          </div>

          {/* ─── Footer ─── */}
          <div className="p-2 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 rounded-b-xl text-[10px] text-slate-400 text-center shrink-0 leading-relaxed">
            Правила применяются сверху вниз.
            <br />
            Первое совпавшее правило «побеждает».
          </div>

          {/* Стрелка-индикатор (опционально) */}
          <Popover.Arrow className="fill-white dark:fill-slate-900" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}