// src/components/dashboard/GroupInfoCard.tsx (рефакторинг)
import { Card } from '@/components/common';
import { Group } from '@/types/dashboard';

interface GroupInfoCardProps {
  group: Group;
  color?: string;
}

export function GroupInfoCard({ group, color = '#3b82f6' }: GroupInfoCardProps) {
  const subtitle = group.description ? (
    <span className="text-sm text-gray-600">{group.description}</span>
  ) : undefined;

  const content = (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-500">ID группы:</span>
        <span className="font-mono text-xs">{group.id}</span>
      </div>

      <div className="flex justify-between">
        <span className="text-gray-500">Дата создания:</span>
        <span>{new Date(group.createdAt).toLocaleString('ru-RU')}</span>
      </div>

      <div className="flex justify-between">
        <span className="text-gray-500">Последнее обновление:</span>
        <span>{new Date(group.updatedAt).toLocaleString('ru-RU')}</span>
      </div>

      <div className="flex justify-between">
        <span className="text-gray-500">Всего условий:</span>
        <span>
          {group.filters.length +
            (group.hierarchyFilters ? Object.keys(group.hierarchyFilters).length : 0)} фильтров
        </span>
      </div>
    </div>
  );

  return (
    <Card
      title={group.name}
      subtitle={subtitle}
      color={color}
      hoverEffect={false}
    >
      {content}
    </Card>
  );
}
