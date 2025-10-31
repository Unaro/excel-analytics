// src/components/dashboard/KPICard.tsx (рефакторинг)
import { Card, ValueWithTrend } from '@/components/common';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export default function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = '#3b82f6',
  trend,
  className,
}: KPICardProps) {
  const rightBadge = (
    <div 
      className="w-12 h-12 rounded-lg flex items-center justify-center"
      style={{ backgroundColor: `${color}20` }}
    >
      <Icon size={24} style={{ color }} />
    </div>
  );

  const subtitleNode = subtitle ? (
    <span className="text-sm text-gray-600">{subtitle}</span>
  ) : undefined;

  const content = (
    <div className="space-y-2">
      <div className="text-3xl font-bold text-gray-900">
        {typeof value === 'number' ? value.toFixed(2) : value}
      </div>
      {trend && (
        <ValueWithTrend
          value={`${Math.abs(trend.value)}%`}
          trend={trend.isPositive ? 'up' : 'down'}
          className="text-sm font-semibold"
        />
      )}
    </div>
  );

  return (
    <Card
      title={title}
      subtitle={subtitleNode}
      color={color}
      rightBadge={rightBadge}
      className={className}
      hoverEffect
    >
      {content}
    </Card>
  );
}
