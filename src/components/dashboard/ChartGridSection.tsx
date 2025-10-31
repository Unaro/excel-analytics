'use client';

import BarChart from '@/components/charts/BarChart';
import LineChart from '@/components/charts/LineChart';
import PieChart from '@/components/charts/PieChart';
import type { ChartDataPoint } from '@/types/dashboard';

interface ChartConfig {
  id: string;
  type: 'bar' | 'line' | 'pie';
  title: string;
  indicators: string | string[];
  data: ChartDataPoint[];
}

interface ChartGridSectionProps {
  charts: ChartConfig[];
  columns?: 1 | 2 | 3;
  height?: number;
  showLegend?: boolean;
}

export function ChartGridSection({
  charts,
  columns = 2,
  height = 400,
  showLegend = true,
}: ChartGridSectionProps): React.ReactNode {
  if (charts.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        <p>Нет данных для отображения графиков</p>
      </div>
    );
  }

  const gridClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  }[columns];

  // Функция для трансформации ChartDataPoint в формат для PieChart
  const transformToPieData = (
    data: ChartDataPoint[],
    indicator: string
  ): Array<{ name: string; value: number }> => {
    return data.map((item) => ({
      name: item.name,
      value: (item[indicator] as number) || 0,
    }));
  };

  return (
    <div className={`grid ${gridClass} gap-6`}>
      {charts.map((chart) => (
        <div
          key={chart.id}
          className="bg-white rounded-lg border border-gray-200 p-6 space-y-4"
        >
          <h3 className="text-lg font-semibold text-gray-900">{chart.title}</h3>

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
                data={transformToPieData(
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
        </div>
      ))}
    </div>
  );
}
