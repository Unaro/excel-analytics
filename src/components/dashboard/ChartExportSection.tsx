'use client';

import { Download } from 'lucide-react';
import BarChart from '@/components/charts/BarChart';
import type { ChartDataPoint } from '@/types/dashboard';

interface ChartExportSectionProps {
  data: ChartDataPoint[];
  indicators: string | string[];
  title: string;
  height?: number;
  onExport: () => void;
  showLegend?: boolean;
  isLoading?: boolean;
}

export function ChartExportSection({
  data,
  indicators,
  title,
  height = 400,
  onExport,
  showLegend = true,
  isLoading = false,
}: ChartExportSectionProps): React.ReactNode {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <button
          onClick={onExport}
          disabled={data.length === 0 || isLoading}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-green-50 text-green-600 rounded hover:bg-green-100 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
        >
          <Download className="w-4 h-4" />
          Экспорт
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center" style={{ height }}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      ) : data.length > 0 ? (
        <div style={{ height }}>
          <BarChart
            data={data}
            indicators={indicators}
            height={height}
            showLegend={showLegend}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center" style={{ height }}>
          <p className="text-gray-600">Нет данных для отображения</p>
        </div>
      )}
    </div>
  );
}
