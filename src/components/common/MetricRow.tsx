// src/components/common/MetricRow.tsx
import { ReactNode } from 'react';
import { TrendingUp } from 'lucide-react';

interface MetricRowProps {
  name: string;
  value: number | string;
  color?: string;
  icon?: ReactNode;
  className?: string;
}

export function MetricRow({ 
  name, 
  value, 
  color = '#3b82f6', 
  icon = <TrendingUp size={16} className="text-blue-600" />,
  className 
}: MetricRowProps) {
  return (
    <div className={`flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors ${className}`}>
      <div className="flex items-center gap-2 flex-1">
        {icon}
        <span className="text-sm font-medium text-gray-700">
          {name}
        </span>
      </div>
      <span className="text-lg font-bold" style={{ color }}>
        {typeof value === 'number' ? value.toFixed(2) : value}
      </span>
    </div>
  );
}
