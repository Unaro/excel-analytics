// src/components/common/IndicatorRow.tsx (новый файл)
import React from 'react';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface IndicatorRowProps {
  name: string;
  value: number;
  color?: string;
  icon?: React.ReactNode;
  precision?: number;
  className?: string;
}

export default function IndicatorRow({
  name,
  value,
  color = '#3b82f6',
  icon = <TrendingUp size={16} className="text-blue-600" />,
  precision = 2,
  className,
}: IndicatorRowProps) {
  return (
    <div 
      className={cn(
        'flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200',
        'hover:border-blue-300 transition-colors',
        className
      )}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {icon}
        <span className="text-sm font-medium text-gray-700 truncate">
          {name}
        </span>
      </div>
      <span className="text-lg font-bold ml-2" style={{ color }}>
        {value.toFixed(precision)}
      </span>
    </div>
  );
}
