'use client';

import { useState, useMemo } from 'react';
import { Search, Plus } from 'lucide-react';
import { GroupCard } from './GroupCard';
import { SimpleEmptyState } from '@/components/common/SimpleEmptyState';
import type { Group } from '@/lib/data-store';

interface GroupsListProps {
  groups: Group[];
  onEdit: (group: Group) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onCreateNew: () => void;
}

export function GroupsList({ 
  groups, 
  onEdit, 
  onDelete, 
  onDuplicate,
  onCreateNew 
}: GroupsListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groups;
    
    const term = searchTerm.toLowerCase();
    return groups.filter(group =>
      group.name.toLowerCase().includes(term) ||
      group.description?.toLowerCase().includes(term)
    );
  }, [groups, searchTerm]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Мои группы ({groups.length})</h2>
        <button
          onClick={onCreateNew}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Создать группу
        </button>
      </div>

      {/* Поиск */}
      {groups.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по группам..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

      {/* Список групп */}
      {filteredGroups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onEdit={onEdit}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
            />
          ))}
        </div>
      ) : groups.length > 0 ? (
        <SimpleEmptyState
          icon={Search}
          title="Группы не найдены"
          description="Попробуйте изменить поисковый запрос"
        />
      ) : (
        <SimpleEmptyState
          icon={Plus}
          title="Нет созданных групп"
          description="Создайте первую группу, чтобы начать работу"
        />
      )}
    </div>
  );
}
