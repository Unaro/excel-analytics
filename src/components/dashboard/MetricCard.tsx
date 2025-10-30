//Подумать над расширением KPICard

import { Metric } from '@/types/dashboard';

interface MetricCardProps {
  metric: Metric;
  className?: string;
}

export function MetricCard({ metric, className = '' }: MetricCardProps) {
  return (
    <div className={`bg-white border rounded-lg p-4 ${className}`}>
      <h4 className="font-medium text-gray-700 mb-2">{metric.name}</h4>
      <div className="text-3xl font-bold text-blue-600 mb-2">
        {metric.aggregatedValue.toFixed(2)}
      </div>
      
      {metric.formula && (
        <div className="mb-3 pb-3 border-b">
          <span className="text-xs text-gray-500">Формула:</span>
          <code className="block mt-1 text-sm bg-gray-50 p-2 rounded">
            {metric.formula}
          </code>
        </div>
      )}
      
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <div className="text-gray-500 text-xs">Среднее</div>
          <div className="font-semibold">{metric.stats.mean.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs">Медиана</div>
          <div className="font-semibold">{metric.stats.median.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs">σ</div>
          <div className="font-semibold">{metric.stats.stdDev.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}
