// src/components/dashboard-builder/ChartGrid.tsx
'use client';

import ChartRenderer from './ChartRenderer';
import { EmptyDashboardState } from './DashboardToolbar';
import type { ChartConfig } from '@/types/dashboard-builder';
import type { ChartDataPoint } from '@/types/dashboard';
import { Plus } from 'lucide-react';

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
    <div className="col-span-12">
      {/* 12-колоночная CSS Grid с правильными размерами */}
      <div 
        className="grid gap-4"
        style={{
          gridTemplateColumns: 'repeat(12, 1fr)',
          gridAutoRows: '120px', // Базовая высота строки
        }}
      >
        {/* Графики */}
        {charts.map((chart) => {
          const chartData = getChartData(chart);
          
          return (
            <div
              key={chart.id}
              style={{
                gridColumn: `span ${Math.min(chart.w, 12)}`,
                gridRow: `span ${Math.min(chart.h, 12)}`,
              }}
              className="relative"
            >
              <ChartRenderer
                config={chart}
                data={chartData}
                isEditMode={isEditMode}
                onEdit={() => onEditChart(chart)}
                onDelete={() => onDeleteChart(chart.id)}
              />
              
              {/* Индикатор размера в режиме редактирования */}
              {isEditMode && (
                <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                  {chart.w}x{chart.h}
                </div>
              )}
            </div>
          );
        })}
        
        {/* Плейсхолдер для добавления нового графика */}
        {isEditMode && (
          <div 
            style={{
              gridColumn: 'span 6',
              gridRow: 'span 3',
            }}
            className="min-h-[360px]"
          >
            <AddChartPlaceholder onAddChart={onAddChart} />
          </div>
        )}
      </div>
    </div>
  );
}

// Отдельный компонент для плейсхолдера
function AddChartPlaceholder({ onAddChart }: { onAddChart: () => void }) {
  return (
    <button
      onClick={onAddChart}
      className="w-full h-full border-3 border-dashed border-blue-300 hover:border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 rounded-xl transition-all duration-300 flex flex-col items-center justify-center group shadow-sm hover:shadow-lg"
    >
      <div className="mb-6">
        <div className="p-6 bg-white group-hover:bg-blue-500 rounded-full shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-110">
          <Plus className="w-12 h-12 text-blue-500 group-hover:text-white transition-colors duration-300" />
        </div>
      </div>
      
      <div className="text-center space-y-3">
        <h3 className="text-2xl font-bold text-gray-700 group-hover:text-blue-600 transition-colors duration-300">
          Добавить график
        </h3>
        
        <p className="text-gray-500 group-hover:text-blue-500 transition-colors duration-300 max-w-xs leading-relaxed">
          Создайте новую визуализацию для ваших данных
        </p>
        
        <div className="flex items-center justify-center gap-2 text-sm text-blue-600 font-medium">
          <span>Кликните для настройки</span>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
        </div>
      </div>
    </button>
  );
}

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