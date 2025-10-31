// src/components/groups/GroupCard.tsx (рефакторинг с кнопкой создания подгрупп)
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  MoreVertical, 
  Edit, 
  Trash2, 
  Copy, 
  ExternalLink, 
  Layers, 
  Filter, 
  Database, 
  TreePine
} from 'lucide-react';
import type { Group } from '@/lib/data-store';
import { Card } from '@/components/common';
import { ConfirmMenu } from '@/components/common';
import { useSubGroupsManager } from '@/hooks/useSubGroupsManager';
import { CreateSubGroupsModal } from './CreateSubGroupsModal';

interface GroupCardProps {
  group: Group;
  onEdit: (group: Group) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onSubGroupsCreated?: (count: number) => void;
  color?: string;
}

export function GroupCard({ 
  group, 
  onEdit, 
  onDelete, 
  onDuplicate, 
  onSubGroupsCreated,
  color = '#3b82f6' 
}: GroupCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const filterCount = group.filters.length + (group.hierarchyFilters ? Object.keys(group.hierarchyFilters).length : 0);

  // Хук для управления подгруппами
  const subGroupsManager = useSubGroupsManager({ parentGroup: group });

  // Обработчик создания подгрупп
  const handleCreateSubGroups = async (groupsToCreate: Parameters<typeof subGroupsManager.createSubGroups>[0]) => {
    const result = await subGroupsManager.createSubGroups(groupsToCreate);
    
    if (result.success && onSubGroupsCreated) {
      onSubGroupsCreated(result.count);
    }
  };

  const rightBadge = (
    <button
      onClick={() => setMenuOpen(!menuOpen)}
      className="p-1 hover:bg-gray-100 rounded transition-colors"
      aria-label="Открыть меню действий"
    >
      <MoreVertical className="w-5 h-5 text-gray-500" />
    </button>
  );

  return (
    <div className="relative">
      <Card
        title={
          <Link href={`/dashboard/group/${group.id}`} className="hover:text-blue-600 transition-colors flex items-center group">
            {group.name}
            <ExternalLink className="w-4 h-4 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link> as unknown as string // TS: если title требует string, смени тип CardProps.title на ReactNode
        }
        subtitle={group.description ? <span className="text-sm text-gray-600">{group.description}</span> : undefined}
        color={color}
        rightBadge={rightBadge}
        hoverEffect={false}
      >
        <div className="space-y-4">
          {/* Основная статистика */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Layers className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-lg font-bold text-gray-900">{group.indicators.length}</div>
              <div className="text-xs text-gray-500">Показателей</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Filter className="w-4 h-4 text-orange-500" />
              </div>
              <div className="text-lg font-bold text-gray-900">{filterCount}</div>
              <div className="text-xs text-gray-500">Фильтров</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Database className="w-4 h-4 text-green-500" />
              </div>
              <div className="text-xs text-gray-500 mt-1">{new Date(group.createdAt).toLocaleDateString('ru-RU')}</div>
            </div>
          </div>
          
          {/* Кнопка создания подгрупп */}
          {subGroupsManager.subGroupInfo.canCreate && (
            <div className="pt-3 border-t border-gray-100">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  subGroupsManager.openModal();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                title={`Создать ${subGroupsManager.subGroupInfo.count} подгрупп для уровня "${subGroupsManager.subGroupInfo.nextLevel}"`}
              >
                <TreePine className="w-4 h-4" />
                <span>Создать подгруппы</span>
                <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">
                  {subGroupsManager.subGroupInfo.count}
                </span>
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Меню действий */}
      {menuOpen && (
        <div className="absolute right-2 top-2">
          <ConfirmMenu
            onClose={() => setMenuOpen(false)}
            actions={[
              { label: 'Редактировать', onClick: () => onEdit(group), icon: <Edit className="w-4 h-4" /> },
              { label: 'Дублировать', onClick: () => onDuplicate(group.id), icon: <Copy className="w-4 h-4" /> },
              // Добавляем опцию создания подгрупп, если доступно
              ...(subGroupsManager.subGroupInfo.canCreate ? [{
                label: `Создать подгруппы (${subGroupsManager.subGroupInfo.count})`,
                onClick: () => {
                  setMenuOpen(false);
                  subGroupsManager.openModal();
                },
                icon: <TreePine className="w-4 h-4" />
              }] : []),
              {
                label: 'Удалить',
                onClick: () => {
                  if (confirm(`Удалить группу "${group.name}"?`)) onDelete(group.id);
                },
                icon: <Trash2 className="w-4 h-4" />,
                danger: true,
              },
            ]}
          />
        </div>
      )}
      
      {/* Модальное окно создания подгрупп */}
      <CreateSubGroupsModal
        isOpen={subGroupsManager.isModalOpen}
        onClose={subGroupsManager.closeModal}
        parentGroup={group}
        hierarchyConfig={subGroupsManager.modalProps.hierarchyConfig}
        data={subGroupsManager.modalProps.data}
        onCreateGroups={handleCreateSubGroups}
      />
    </div>
  );
}