// src/components/dashboard-builder/ChartGrid.tsx
'use client';

import ChartRenderer from './ChartRenderer';
import { EmptyDashboardState } from './DashboardToolbar';
import { ResizableChart } from './ResizableChart';
import type { ChartConfig } from '@/types/dashboard-builder';
import type { ChartDataPoint } from '@/types/dashboard';
import { Plus, BarChart3, Zap } from 'lucide-react';

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
      {/* 12-колоночная CSS Grid с правильными размерами */}
      <div 
        className="grid gap-4"
        style={{
          gridTemplateColumns: 'repeat(12, 1fr)',
          gridAutoRows: '120px',
        }}
      >
        {/* Графики */}
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
                isEditMode={false} // ResizableChart уже обрабатывает режим редактирования
              />
            </ResizableChart>
          );
        })}
        
        {/* Улучшенный плейсхолдер для добавления графика */}
        {isEditMode && (
          <div 
            style={{
              gridColumn: 'span 6',
              gridRow: 'span 4',
            }}
            className="min-h-[480px]"
          >
            <EnhancedAddChartPlaceholder onAddChart={onAddChart} />
          </div>
        )}
      </div>
    </div>
  );
}

// Улучшенный плейсхолдер для добавления графика
function EnhancedAddChartPlaceholder({ onAddChart }: { onAddChart: () => void }) {
  return (
    <button
      onClick={onAddChart}
      className="w-full h-full border-3 border-dashed border-blue-300 hover:border-blue-500 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 hover:from-blue-100 hover:via-purple-100 hover:to-pink-100 rounded-2xl transition-all duration-500 flex flex-col items-center justify-center group shadow-lg hover:shadow-2xl transform hover:scale-[1.02]"
    >
      {/* Иконка */}
      <div className="mb-8">
        <div className="p-8 bg-white group-hover:bg-blue-500 rounded-full shadow-xl group-hover:shadow-2xl transition-all duration-500 transform group-hover:scale-110 group-hover:rotate-12">
          <Plus className="w-16 h-16 text-blue-500 group-hover:text-white transition-colors duration-500" />
        </div>
      </div>
      
      {/* Текст */}
      <div className="text-center space-y-4 max-w-sm">
        <h3 className="text-3xl font-bold text-gray-700 group-hover:text-blue-600 transition-colors duration-300">
          Добавить график
        </h3>
        
        <p className="text-lg text-gray-500 group-hover:text-blue-500 transition-colors duration-300 leading-relaxed">
          Создайте новую визуализацию данных
          <br />
          с мощными настройками фильтрации
        </p>
        
        {/* Свойства */}
        <div className="flex items-center justify-center gap-6 text-sm text-blue-600 font-medium opacity-80 group-hover:opacity-100">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            <span>5 типов</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            <span>Интерактивные</span>
          </div>
        </div>
        
        <div className="flex items-center justify-center gap-2 text-sm text-blue-600 font-semibold">
          <span>Кликните для начала</span>
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
    <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
        <div>
          <div className="font-bold text-blue-800 text-lg">
            {filteredRows.toLocaleString()} строк
          </div>
          <div className="text-sm text-blue-600">
            из {totalRows.toLocaleString()} общего объёма
          </div>
        </div>
      </div>
      
      <div className="text-right">
        <div className="text-3xl font-bold text-blue-700">
          {percentage}%
        </div>
        <div className="text-xs text-blue-500 uppercase tracking-wider">
          Отфильтровано
        </div>
      </div>
    </div>
  );
}