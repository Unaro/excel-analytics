'use client';

import { useState, useEffect } from 'react';
import { useGroups } from '@/hooks/useGroups';
import { useIndicators } from '@/hooks/useIndicators';
import { useHierarchy } from '@/hooks/useHierarchy';
import { GroupsList } from '@/components/groups/GroupsList';
import { GroupForm } from '@/components/groups/GroupForm';
import { IndicatorLibrary } from '@/components/groups/IndicatorLibrary';
import { IndicatorForm } from '@/components/groups/IndicatorForm';
import EmptyState from '@/components/dashboard/EmptyState';
import { AlertCircle } from 'lucide-react';
import { dataStore } from '@/lib/data-store';
import type { Group, Indicator } from '@/lib/data-store';

type ViewMode = 'list' | 'create' | 'edit' | 'indicator';

export default function GroupsPage() {
  const { groups, loading: groupsLoading, createGroup, updateGroup, deleteGroup, duplicateGroup } = useGroups();
  const { indicators, addIndicator, removeIndicator } = useIndicators();
  const { config: hierarchyConfig, loading: hierarchyLoading } = useHierarchy();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [rawData, setRawData] = useState<import('@/types').ExcelRow[]>([]);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const headers = dataStore.getHeaders();
    const data = dataStore.getRawData();
    const dataExists = dataStore.hasData();

    setAvailableFields(headers);
    setRawData(data);
    setHasData(dataExists);
  }, []);

  const handleCreateGroup = () => {
    setEditingGroup(null);
    setViewMode('create');
  };

  const handleEditGroup = (group: Group) => {
    setEditingGroup(group);
    setViewMode('edit');
  };

  const handleSaveGroup = (groupData: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingGroup) {
      updateGroup(editingGroup.id, groupData);
    } else {
      createGroup(groupData);
    }
    setViewMode('list');
    setEditingGroup(null);
  };

  const handleCancel = () => {
    setViewMode('list');
    setEditingGroup(null);
  };

  const handleDeleteGroup = (id: string) => {
    deleteGroup(id);
  };

  const handleDuplicateGroup = (id: string) => {
    duplicateGroup(id);
  };

  const handleCreateIndicator = () => {
    setViewMode('indicator');
  };

  const handleSaveIndicator = (indicator: Indicator) => {
    addIndicator(indicator);
    setViewMode('list');
  };

  // Callback для добавления показателя в библиотеку внутри GroupForm
  const handleAddIndicatorToLibrary = (indicator: Indicator) => {
    addIndicator(indicator);
  };

  const handleAddIndicatorToGroup = (indicator: Indicator) => {
    alert(`Откройте группу для добавления показателя "${indicator.name}"`);
  };

  if (groupsLoading || hierarchyLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <EmptyState
          icon={AlertCircle}
          title="Нет загруженных данных"
          description="Загрузите Excel файл для начала работы с группами"
          actionLabel="Загрузить данные"
          actionHref="/"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Управление группами</h1>
        <p className="text-gray-600">Создавайте группы с фильтрами и вычисляемыми показателями</p>
      </div>

      {viewMode === 'list' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <GroupsList
              groups={groups}
              onEdit={handleEditGroup}
              onDelete={handleDeleteGroup}
              onDuplicate={handleDuplicateGroup}
              onCreateNew={handleCreateGroup}
            />
          </div>

          <div>
            <IndicatorLibrary
              indicators={indicators}
              onAddToGroup={handleAddIndicatorToGroup}
              onDelete={removeIndicator}
              onCreateNew={handleCreateIndicator}
            />
          </div>
        </div>
      )}

      {(viewMode === 'create' || viewMode === 'edit') && (
        <GroupForm
          group={editingGroup}
          onSave={handleSaveGroup}
          onCancel={handleCancel}
          availableFields={availableFields}
          rawData={rawData}
          hierarchyConfig={hierarchyConfig}
          libraryIndicators={indicators}
          onAddIndicatorToLibrary={handleAddIndicatorToLibrary}  // Передаем callback!
        />
      )}

      {viewMode === 'indicator' && (
        <div className="max-w-4xl mx-auto">
          <IndicatorForm
            onSave={handleSaveIndicator}
            onCancel={handleCancel}
            availableFields={availableFields}
            isInlineMode={false} 
            onAddToLibrary={addIndicator}  // Добавляем в библиотеку
          />
        </div>
      )}
    </div>
  );
}
