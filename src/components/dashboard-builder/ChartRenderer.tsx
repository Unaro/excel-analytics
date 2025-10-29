'use client';

import { useMemo } from 'react';
import { ChartConfig } from '@/types/dashboard-builder';
import BarChart from '@/components/charts/BarChart';
import LineChart from '@/components/charts/LineChart';
import PieChart from '@/components/charts/PieChart';
import { Edit2, Trash2, Maximize2 } from 'lucide-react';

interface ChartRendererProps {
  config: ChartConfig;
  data: any[];
  onEdit?: () => void;
  onDelete?: () => void;
  isEditMode?: boolean;
}

export default function ChartRenderer({
  config,
  data,
  onEdit,
  onDelete,
  isEditMode = false,
}: ChartRendererProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data;
  }, [data]);

  const renderChart = () => {
    if (chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-gray-400">
          <div className="text-center">
            <p className="text-lg font-semibold">Нет данных</p>
            <p className="text-sm">Настройте источник данных</p>
          </div>
        </div>
      );
    }

    const height = config.h * 80 - 100; // Высота в пикселях

    switch (config.type) {
      case 'bar':
        return (
          <BarChart
            data={chartData}
            indicators={config.indicators || 'value'}
            height={height}
            showLegend={config.showLegend}
          />
        );

      case 'line':
        return (
          <LineChart
            data={chartData}
            indicators={config.indicators || 'value'}
            height={height}
            showLegend={config.showLegend}
          />
        );

      case 'pie':
        return (
          <PieChart
            data={chartData}
            height={height}
            showLegend={config.showLegend}
          />
        );

      case 'metric':
        const value = chartData.length > 0 && config.indicators?.[0]
          ? chartData.reduce((sum, d) => sum + (Number(d[config.indicators![0]]) || 0), 0)
          : 0;
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-6xl font-bold text-blue-600">{value.toFixed(2)}</p>
              <p className="text-gray-600 mt-2">{config.indicators?.[0] || 'Значение'}</p>
            </div>
          </div>
        );

      case 'table':
        const headers = chartData.length > 0 ? Object.keys(chartData[0]) : [];
        return (
          <div className="overflow-auto h-full">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {headers.map(header => (
                    <th
                      key={header}
                      className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {chartData.slice(0, 20).map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    {headers.map(header => (
                      <td key={header} className="px-4 py-2 text-sm text-gray-900">
                        {typeof row[header] === 'number'
                          ? row[header].toFixed(2)
                          : String(row[header])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      default:
        return <div>Неизвестный тип графика</div>;
    }
  };

  return (
    <div
      className="bg-white rounded-xl shadow-lg border-2 border-gray-200 overflow-hidden group relative"
      style={{
        gridColumn: `span ${config.w}`,
        gridRow: `span ${config.h}`,
      }}
    >
      {/* Заголовок */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-bold text-gray-900">{config.title}</h3>
        {isEditMode && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="p-1.5 hover:bg-blue-100 rounded transition-colors"
              title="Редактировать"
            >
              <Edit2 size={16} className="text-blue-600" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 hover:bg-red-100 rounded transition-colors"
              title="Удалить"
            >
              <Trash2 size={16} className="text-red-600" />
            </button>
          </div>
        )}
      </div>

      {/* Контент */}
      <div className="p-4" style={{ height: `calc(100% - 60px)` }}>
        {renderChart()}
      </div>
    </div>
  );
}
