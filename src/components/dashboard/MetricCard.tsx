// src/components/dashboard/MetricCard.tsx (рефакторинг)
import { Card } from '@/components/common';
import { Metric } from '@/types/dashboard';

interface MetricCardProps {
  metric: Metric;
  color?: string;
  className?: string;
}

export function MetricCard({ metric, color = '#3b82f6', className }: MetricCardProps) {
  const title = metric.name;
  const subtitle = metric.formula ? (
    <div className="text-xs">
      <span className="text-gray-500">Формула:</span>
      <code className="block mt-1 text-gray-700 bg-gray-50 p-2 rounded">
        {metric.formula}
      </code>
    </div>
  ) : undefined;

  const content = (
    <>
      <div className="text-3xl font-bold" style={{ color }}>
        {metric.aggregatedValue.toFixed(2)}
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm mt-4">
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
    </>
  );

  return (
    <Card
      title={title}
      subtitle={subtitle}
      color={color}
      className={className}
      hoverEffect
    >
      {content}
    </Card>
  );
}
