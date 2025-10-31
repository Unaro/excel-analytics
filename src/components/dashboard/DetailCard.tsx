// src/components/dashboard/DetailCard.tsx
import { COLORS } from '@/lib/storage';
import { Filter, Layers, ArrowRight } from 'lucide-react';
import { 
  Card, 
  StatusPill, 
  BadgeNumber, 
  MetricRow 
} from '@/components/common';

interface DetailCardProps {
  data: {
    groupId: string;
    groupName: string;
    filters: {
      id: string;
      column: string;
      operator: string;
      value: string;
    }[];
    hierarchyFilters: Record<string, string> | undefined;
    deepestFilter: {
      column: string;
      value: string;
    } | null;
    indicators: {
      name: string;
      formula: string;
      value: number;
    }[];
    rowCount: number;
  };
  index: number;
}

export default function DetailCard({ data, index }: DetailCardProps) {
  const color = COLORS[index % COLORS.length];

  const subtitle = data.deepestFilter ? (
    <StatusPill 
      variant="primary" 
      icon={<Layers size={14} />}
    >
      <span className="font-medium">
        {data.deepestFilter.column}: {data.deepestFilter.value}
      </span>
    </StatusPill>
  ) : undefined;

  const rightBadge = <BadgeNumber number={index + 1} color={color} />;

  const indicators = (
    <div className="space-y-3">
      {data.indicators.map((indicator) => (
        <MetricRow
          key={indicator.name}
          name={indicator.name}
          value={indicator.value}
          color={color}
        />
      ))}
    </div>
  );

  const footer = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Filter size={14} />
        <span>На основе {data.rowCount} записей</span>
      </div>
      <div className="flex items-center gap-1 text-sm text-blue-600 font-medium group-hover:gap-2 transition-all">
        <span>Подробнее</span>
        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  );

  return (
    <Card
      title={data.groupName}
      subtitle={subtitle}
      color={color}
      href={`/dashboard/group/${data.groupId}`}
      rightBadge={rightBadge}
      footer={footer}
    >
      {indicators}
    </Card>
  );
}
