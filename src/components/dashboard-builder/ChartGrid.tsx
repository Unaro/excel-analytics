// src/components/dashboard-builder/ChartGrid.tsx
'use client';

import ChartRenderer from './ChartRenderer';
import { EmptyDashboardState } from './DashboardToolbar';
import { ResizableChart } from './ResizableChart';
import Placeholder from '@/components/common/Placeholder';
import type { ChartConfig } from '@/types/dashboard-builder';
import type { ChartDataPoint } from '@/types/dashboard';

interface ChartGridProps {
  charts: ChartConfig[];
  getChartData: (config: ChartConfig) => ChartDataPoint[];
  isEditMode: boolean;
  onEditChart: (chart: ChartConfig) => void;
  onDeleteChart: (chartId: string) => void;
  onUpdateChart: (chartId: string, updates: Partial<ChartConfig>) => void;
  onAddChart: () => void;
}

export function ChartGrid({
  charts,
  getChartData,
  isEditMode,
  onEditChart,
  onDeleteChart,
  onUpdateChart,
  onAddChart,
}: ChartGridProps) {
  if (charts.length === 0) {
    return <EmptyDashboardState onAddChart={onAddChart} />;
  }

  return (
    <div className="col-span-12">
      <div 
        className="grid gap-4"
        style={{
          gridTemplateColumns: 'repeat(12, 1fr)',
          gridAutoRows: '120px',
        }}
      >
        {charts.map((chart) => {
          const chartData = getChartData(chart);
          
          return (
            <ResizableChart
              key={chart.id}
              config={chart}
              data={chartData}
              isEditMode={isEditMode}
              onConfigChange={(updates) => onUpdateChart(chart.id, updates)}
              onEdit={() => onEditChart(chart)}
              onDelete={() => onDeleteChart(chart.id)}
            >
              <ChartRenderer
                config={chart}
                data={chartData}
                isEditMode={false}
              />
            </ResizableChart>
          );
        })}

        {isEditMode && (
          <div 
            style={{ gridColumn: 'span 6', gridRow: 'span 4' }}
            className="min-h-[480px]"
          >
            <Placeholder
              title="Добавить график"
              description="Создайте новую визуализацию с настройками фильтрации"
              onClick={onAddChart}
            />
          </div>
        )}
      </div>
    </div>
  );
}
