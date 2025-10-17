'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: number | string;
  unit?: string;
  trend?: number;
  status?: 'positive' | 'negative' | 'neutral';
  color?: string;
  onClick?: () => void;
}

export default function KPICard({
  label,
  value,
  unit = '',
  trend,
  status = 'neutral',
  color = 'blue',
  onClick,
}: KPICardProps) {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
    cyan: 'from-cyan-500 to-cyan-600',
    pink: 'from-pink-500 to-pink-600',
  };

  const gradientClass = colors[color as keyof typeof colors] || colors.blue;

  const getTrendIcon = () => {
    if (!trend) return null;
    if (status === 'positive') return <TrendingUp size={20} />;
    if (status === 'negative') return <TrendingDown size={20} />;
    return <Minus size={20} />;
  };

  const getTrendColor = () => {
    if (status === 'positive') return 'text-green-300';
    if (status === 'negative') return 'text-red-300';
    return 'text-gray-300';
  };

  return (
    <div
      onClick={onClick}
      className={`
        bg-gradient-to-br ${gradientClass} rounded-lg shadow-lg p-6 text-white
        ${onClick ? 'cursor-pointer hover:shadow-xl transition-shadow' : ''}
      `}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm opacity-90 font-medium">{label}</p>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 ${getTrendColor()}`}>
            {getTrendIcon()}
            <span className="text-xs font-semibold">
              {Math.abs(trend)}%
            </span>
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <p className="text-3xl font-bold">
          {typeof value === 'number' ? value.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) : value}
        </p>
        {unit && <span className="text-lg opacity-80">{unit}</span>}
      </div>
    </div>
  );
}
