import { VirtualMetric } from "@/shared/lib/validators";
import { useCallback, useState } from "react";
import { DashboardViewState } from "../ui/DashboardViewContent";
import { ChartType } from "@/entities/dashboard/model/types";

/**
 * UI-состояние виджета просмотра дашборда.
 *
 * Отвечает за:
 *  - Какие метрики выбраны для чартов (single-режим: radio, до 5 штук)
 *  - Какие типы чартов активны (single-режим: radio, ровно 1)
 *  - Какие метрики скрыты в таблице метрик
 *
 * Логика toggle (add/remove одного id) живёт внутри ChartsSectionWidget,
 * сюда приходит уже готовый массив — это соответствует контракту
 * `ChartsSectionWidgetProps.onActiveMetricIdsChange: (ids: string[]) => void`.
 */
export function useDashboardViewState(
  dashboardVirtualMetrics: VirtualMetric[]
): DashboardViewState {
  const [activeMetricIds, setActiveMetricIds] = useState<string[]>(() =>
    dashboardVirtualMetrics.length > 0 ? [dashboardVirtualMetrics[0].id] : []
  );
  const [chartTypes, setChartTypes] = useState<ChartType[]>(['bar']);
  const [hiddenMetricIds, setHiddenMetricIds] = useState<string[]>([]);

  const toggleMetricVisibility = useCallback((id: string) => {
    setHiddenMetricIds(prev =>
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    );
  }, []);

  return {
    activeMetricIds,
    chartTypes,
    hiddenMetricIds,
    setActiveMetricIds,
    setChartTypes,
    toggleMetricVisibility,
  };
}