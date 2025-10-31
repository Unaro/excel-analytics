'use client';

import { useState, useEffect } from 'react';
import { Share2, FileJson, Library } from 'lucide-react';
import { useGroups } from '@/hooks/useGroups';
import { useIndicators } from '@/hooks/useIndicators';
import { useHierarchy } from '@/hooks/useHierarchy';
import { GroupsList } from '@/components/groups/GroupsList';
import { GroupForm } from '@/components/groups/GroupForm';
import { IndicatorLibrary } from '@/components/groups/IndicatorLibrary';
import { IndicatorForm } from '@/components/groups/IndicatorForm';
import { IndicatorExchange } from '@/components/groups/IndicatorExchange';
import EmptyState from '@/components/dashboard/EmptyState';
import { AlertCircle } from 'lucide-react';
import { dataStore } from '@/lib/data-store';
import type { Group, Indicator } from '@/lib/data-store';
import { SimpleEmptyState } from '@/components/common/SimpleEmptyState';
import { ExcelRow } from '@/types';

type ViewMode = 'list' | 'create' | 'edit' | 'indicator' | 'exchange' | 'library';


export default function GroupsPage() {
  const {
    groups,
    loading: groupsLoading,
    createGroup,
    updateGroup,
    deleteGroup,
    duplicateGroup,
  } = useGroups();
  const { indicators, addIndicator, removeIndicator } = useIndicators();
  const { config: hierarchyConfig, loading: hierarchyLoading } = useHierarchy();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [rawData, setRawData] = useState<ExcelRow[]>([]);
  const [hasData, setHasData] = useState(false);
  const [importLoading, setImportLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const headers = dataStore.getHeaders();
    const data = dataStore.getRawData();
    const dataExists = dataStore.hasData();

    setAvailableFields(headers);
    setRawData(data);
    setHasData(dataExists);
  }, []);

  const handleCreateGroup = (): void => {
    setEditingGroup(null);
    setViewMode('create');
  };

  const handleEditGroup = (group: Group): void => {
    setEditingGroup(group);
    setViewMode('edit');
  };

  const handleSaveGroup = (groupData: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>): void => {
    if (editingGroup) {
      updateGroup(editingGroup.id, groupData);
    } else {
      createGroup(groupData);
    }

    setViewMode('list');
    setEditingGroup(null);
  };

  const handleCancel = (): void => {
    setViewMode('list');
    setEditingGroup(null);
  };

  const handleDeleteGroup = (id: string): void => {
    deleteGroup(id);
  };

  const handleDuplicateGroup = (id: string): void => {
    duplicateGroup(id);
  };

  const handleCreateIndicator = (): void => {
    setViewMode('indicator');
  };

  const handleSaveIndicator = (indicator: Indicator): void => {
    addIndicator(indicator);
    setViewMode('list');
  };

  const handleAddIndicatorToLibrary = (indicator: Indicator): void => {
    addIndicator(indicator);
  };

  const handleAddIndicatorToGroup = (indicator: Indicator): void => {
    alert(`Откройте группу для добавления показателя "${indicator.name}"`);
  };

  const handleImportIndicators = async (newIndicators: Indicator[]): Promise<void> => {
    setImportLoading(true);
    try {
      for (const indicator of newIndicators) {
        const exists = indicators.some((ind) => ind.name === indicator.name);
        if (!exists) {
          addIndicator(indicator);
        }
      }
    } finally {
      setImportLoading(false);
    }
  };

  const allIndicators = groups.flatMap((g) => g.indicators);

  if (groupsLoading || hierarchyLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <SimpleEmptyState
        icon={AlertCircle}
        title="Нет загруженных данных"
        description="Загрузите Excel файл на главной странице, чтобы создать группы."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Управление группами</h1>
        <p className="text-gray-600 mt-2">Создавайте группы с фильтрами и вычисляемыми показателями</p>
      </div>

      {/* Вкладки */}
      <div className="border-b border-gray-200 flex gap-4">
        <button
          onClick={() => setViewMode('list')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            viewMode === 'list'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Группы ({groups.length})
        </button>
        <button
          onClick={() => setViewMode('library')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors flex items-center gap-2 ${
            viewMode === 'library'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Library className="w-4 h-4" />
          Показатели ({indicators.length})
        </button>
        <button
          onClick={() => setViewMode('exchange')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors flex items-center gap-2 ${
            viewMode === 'exchange'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Share2 className="w-4 h-4" />
          Экспорт
        </button>
      </div>

      {viewMode === 'list' && (
        <GroupsList
          groups={groups}
          onEdit={handleEditGroup}
          onDelete={handleDeleteGroup}
          onDuplicate={handleDuplicateGroup}
          onCreateNew={handleCreateGroup}
        />
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
          onAddIndicatorToLibrary={handleAddIndicatorToLibrary}
        />
      )}

      {viewMode === 'indicator' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Создать показатель</h2>
          <IndicatorForm
            onSave={handleSaveIndicator}
            onCancel={handleCancel}
            availableFields={availableFields}
            existingNames={indicators.map((ind) => ind.name)}
            isInlineMode={true}
          />
        </div>
      )}

      {/* Вкладка обмена */}
      {viewMode === 'exchange' && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-3 mb-6">
            <FileJson className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900">Экспорт</h2>
          </div>

          {allIndicators.length === 0 ? (
            <p className="text-gray-600">Создайте группу с показателями, чтобы их экспортировать</p>
          ) : (
            <>
              <p className="text-gray-600 mb-6">
                Экспортируйте показатели из всех групп, чтобы поделиться ими или создать резервную
                копию. Импортируйте показатели, которые получили от других пользователей.
              </p>

              <IndicatorExchange
                indicators={allIndicators}
                onImport={handleImportIndicators}
                isLoading={importLoading}
              />
            </>
          )}
        </div>
      )}

      {viewMode === 'library' && (
        <IndicatorLibrary
          indicators={indicators}
          onAddToGroup={(indicator) => {
            alert(`Показатель "${indicator.name}" готов к добавлению в группу`);
          }}
          onDelete={removeIndicator}
          onCreateNew={handleCreateIndicator}
        />
      )}
    </div>
  );
}
