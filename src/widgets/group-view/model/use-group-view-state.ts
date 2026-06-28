'use client';
import { useState, useCallback, useMemo } from 'react';
import type { VirtualMetric } from '@/shared/lib/validators';
import { SortConfig } from './types';
import { useGroupViewPrefsStore } from './group-view-prefs-store';

/**
 * UI-состояние виджета просмотра группы.
 * Управляет выбором метрик для визуализации и сортировкой.
 *
 * Выбор метрик ПЕРСИСТИТСЯ per-group (group-view-prefs-store) по sourceMetricId —
 * при возврате на группу восстанавливаются последние выбранные метрики, а не
 * всегда первая. Сортировка остаётся локальной (дериватив от активной метрики).
 *
 * Типы чартов (`chartTypes`) персистятся на группе (IndicatorGroup.chartView).
 *
 * Дефолты («первая метрика активна», «сортировка по первой активной»)
 * ДЕРИВИРУЮТСЯ во время рендера, а не записываются в state эффектами:
 * setState-в-эффекте давал лишний каскадный ререндер и расходился
 * со Strict Mode (react-hooks/set-state-in-effect).
 */
export function useGroupViewState(groupId: string, virtualMetrics: VirtualMetric[]) {
  const [userSortConfig, setUserSortConfig] = useState<SortConfig | null>(null);

  // Сохранённый выбор (по sourceMetricId) + сеттер предпочтений.
  const selectedSourceMetricIds = useGroupViewPrefsStore(
    s => s.prefsByGroup[groupId]?.selectedSourceMetricIds
  );
  const setPrefs = useGroupViewPrefsStore(s => s.setPrefs);

  // Активные vm-id: метрики, чей sourceMetricId в сохранённом наборе (в порядке
  // самих метрик). Пусто/нет сохранённого → дефолт «первая метрика группы».
  const activeMetricIds = useMemo(() => {
    const saved = selectedSourceMetricIds;
    if (saved && saved.length > 0) {
      const set = new Set(saved);
      const ids = virtualMetrics
        .filter(vm => vm.sourceMetricId != null && set.has(vm.sourceMetricId))
        .map(vm => vm.id);
      if (ids.length > 0) return ids; // иначе сохранённые метрики удалены → дефолт
    }
    return virtualMetrics.length > 0 ? [virtualMetrics[0].id] : [];
  }, [selectedSourceMetricIds, virtualMetrics]);

  const sortConfig: SortConfig | null = useMemo(() => {
    return userSortConfig ??
      (activeMetricIds.length > 0
        ? { key: activeMetricIds[0], direction: 'desc' }
        : null);
  }, [userSortConfig, activeMetricIds]);

  const handleToggleMetric = useCallback((metricId: string) => {
    const vm = virtualMetrics.find(v => v.id === metricId);
    const target = vm?.sourceMetricId;
    if (!target) return;

    // База — эффективный выбор по sourceMetricId (с учётом дефолта «первая»).
    const savedNow = useGroupViewPrefsStore.getState().prefsByGroup[groupId]
      ?.selectedSourceMetricIds;
    const validSaved = savedNow?.filter(sid => virtualMetrics.some(v => v.sourceMetricId === sid));
    const firstSid = virtualMetrics[0]?.sourceMetricId;
    const base =
      validSaved && validSaved.length > 0
        ? validSaved
        : firstSid
          ? [firstSid]
          : [];

    let next: string[];
    if (base.includes(target)) {
      if (base.length === 1) return; // минимум одна метрика
      next = base.filter(sid => sid !== target);
    } else {
      next = [...base, target];
    }
    setPrefs(groupId, { selectedSourceMetricIds: next });
  }, [virtualMetrics, groupId, setPrefs]);

  return {
    activeMetricIds,
    sortConfig,
    setSortConfig: setUserSortConfig,
    handleToggleMetric,
  };
}
