// src/components/dashboard/ChartGridSection.tsx (рефакторинг)
'use client';

import { Card } from '@/components/common';
import BarChart from '@/components/charts/BarChart';
import LineChart from '@/components/charts/LineChart';
import PieChart from '@/components/charts/PieChart';
import type { ChartDataPoint } from '@/types/dashboard';

interface ChartConfig {
  id: string;
  type: 'bar' | 'line' | 'pie';
  title: string;
  description?: string;
  indicators: string | string[];
  data: ChartDataPoint[];
}

interface ChartGridSectionProps {
  charts: ChartConfig[];
  columns?: 1 | 2 | 3;
  height?: number;
  showLegend?: boolean;
  className?: string;
}

function toPieData(
  data: ChartDataPoint[],
  indicator: string
): Array<{ name: string; value: number }> {
  return data.map((item) => ({
    name: item.name,
    value: (item[indicator] as number) || 0,
  }));
}

export function ChartGridSection({
  charts,
  columns = 2,
  height = 400,
  showLegend = true,
  className,
}: ChartGridSectionProps) {
  if (charts.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        Нет данных для отображения графиков
      </div>
    );
  }

  const gridClass =
    columns === 1
      ? 'grid-cols-1'
      : columns === 2
      ? 'grid-cols-1 md:grid-cols-2'
      : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

  return (
    <div className={`grid ${gridClass} gap-6 ${className || ''}`}>
      {charts.map((chart) => {
        const subtitle = chart.description ? (
          <span className="text-sm text-gray-600">{chart.description}</span>
        ) : undefined;

        return (
          <Card
            key={chart.id}
            title={chart.title}
            subtitle={subtitle}
            hoverEffect
            // цвет можно варьировать при необходимости через проп color
          >
            <div style={{ height }}>
              {chart.type === 'bar' && (
                <BarChart
                  data={chart.data}
                  indicators={chart.indicators}
                  height={height}
                  showLegend={showLegend}
                />
              )}

              {chart.type === 'line' && (
                <LineChart
                  data={chart.data}
                  indicators={chart.indicators}
                  height={height}
                  showLegend={showLegend}
                />
              )}

              {chart.type === 'pie' && (
                <PieChart
                  data={toPieData(
                    chart.data,
                    typeof chart.indicators === 'string'
                      ? chart.indicators
                      : chart.indicators[0]
                  )}
                  height={height}
                  showLegend={showLegend}
                />
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
