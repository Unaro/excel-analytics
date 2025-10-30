import { Group } from '@/types/dashboard';

interface GroupInfoCardProps {
  group: Group;
}

export function GroupInfoCard({ group }: GroupInfoCardProps) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <h3 className="font-semibold text-lg mb-3">{group.name}</h3>
      
      {group.description && (
        <p className="text-gray-600 mb-4">{group.description}</p>
      )}
      
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
    </div>
  );
}
