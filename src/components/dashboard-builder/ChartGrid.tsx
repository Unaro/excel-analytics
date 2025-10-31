// src/components/dashboard-builder/ChartGrid.tsx
'use client';

import { ChartRenderer } from './ChartRenderer';
import { EmptyDashboardState } from './DashboardToolbar';
import type { ChartConfig } from '@/types/dashboard-builder';
import type { ChartDataPoint } from '@/types/dashboard';

interface ChartGridProps {
  charts: ChartConfig[];
  getChartData: (config: ChartConfig) => ChartDataPoint[];
  isEditMode: boolean;
  onEditChart: (chart: ChartConfig) => void;
  onDeleteChart: (chartId: string) => void;
  onAddChart: () => void;
}

export function ChartGrid({
  charts,
  getChartData,
  isEditMode,
  onEditChart,
  onDeleteChart,
  onAddChart,
}: ChartGridProps) {
  if (charts.length === 0) {
    return <EmptyDashboardState onAddChart={onAddChart} />;
  }

  return (
    <div className="space-y-6">
      {/* Автоматическая сетка с адаптивными размерами */}
      <div className="grid gap-6 auto-rows-auto">
        {charts.map((chart, index) => {
          const chartData = getChartData(chart);
          
          // Определяем размер на основе типа графика и позиции
          const getGridClasses = () => {
            // Для первых графиков делаем большие размеры
            if (index === 0 && charts.length > 1) {
              return 'col-span-12 lg:col-span-8'; // Основной график
            }
            
            if (index === 1 && charts.length > 1) {
              return 'col-span-12 lg:col-span-4'; // Дополнительный график
            }
            
            // Остальные графики в зависимости от типа
            switch (chart.type) {
              case 'pie':
              case 'metric':
                return 'col-span-12 sm:col-span-6 lg:col-span-4';
              case 'table':
                return 'col-span-12';
              case 'bar':
              case 'line':
              case 'area':
              default:
                return 'col-span-12 lg:col-span-6';
            }
          };
          
          const getHeightClass = () => {
            switch (chart.type) {
              case 'metric':
                return 'h-32';
              case 'pie':
                return 'h-80';
              case 'table':
                return 'h-96';
              case 'bar':
              case 'line':
              case 'area':
              default:
                return 'h-96';
            }
          };
          
          return (
            <div key={chart.id} className={getGridClasses()}>
              <div className={`w-full ${getHeightClass()}`}>
                <ChartRenderer
                  config={chart}
                  data={chartData}
                  isEditMode={isEditMode}
                  onEdit={() => onEditChart(chart)}
                  onDelete={() => onDeleteChart(chart.id)}
                  className="h-full"
                />
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Кнопка добавления графика в режиме редактирования */}
      {isEditMode && (
        <div className="col-span-12 lg:col-span-6">
          <button
            onClick={onAddChart}
            className="w-full h-64 border-2 border-dashed border-gray-300 hover:border-blue-400 bg-white hover:bg-blue-50 rounded-xl transition-all duration-300 flex flex-col items-center justify-center group"
          >
            <div className="p-4 bg-blue-100 group-hover:bg-blue-200 rounded-full mb-4 transition-colors">
              <svg 
                className="w-8 h-8 text-blue-600" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-700 group-hover:text-blue-600 mb-2 transition-colors">
              Добавить график
            </h3>
            <p className="text-sm text-gray-500 group-hover:text-blue-500 transition-colors">
              Нажмите, чтобы создать новую визуализацию
            </p>
          </button>
        </div>
      )}
    </div>
  );
}

// Компонент статистики фильтрации
export function FilterStats({ 
  totalRows, 
  filteredRows, 
  percentage 
}: { 
  totalRows: number; 
  filteredRows: number; 
  percentage: number; 
}) {
  if (totalRows === filteredRows) return null;
  
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
        <span className="font-medium text-blue-800">
          Отфильтровано: {filteredRows.toLocaleString()} из {totalRows.toLocaleString()} строк
        </span>
      </div>
      <div className="text-blue-600 font-bold">
        {percentage}%
      </div>
    </div>
  );
}