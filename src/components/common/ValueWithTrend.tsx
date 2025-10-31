// src/components/common/ValueWithTrend.tsx
import { ReactNode } from 'react';

interface ValueWithTrendProps {
  value: number | string;
  color?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: ReactNode;
  className?: string;
}

export function ValueWithTrend({ 
  value, 
  color, 
  trend, 
  icon, 
  className 
}: ValueWithTrendProps) {
  const trendColors = {
    up: '#10b981',
    down: '#ef4444',
    neutral: '#6b7280'
  };

  const displayColor = color || (trend ? trendColors[trend] : '#3b82f6');

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {icon}
      <span className="text-lg font-bold" style={{ color: displayColor }}>
        {typeof value === 'number' ? value.toFixed(2) : value}
      </span>
    </div>
  );
}
