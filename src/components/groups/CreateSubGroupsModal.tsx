// src/components/groups/CreateSubGroupsModal.tsx
'use client';

import { useState, useMemo } from 'react';
import { X, Layers, AlertCircle, Info, ChevronDown, ChevronRight } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { useSubGroupCreator } from '@/hooks/useSubGroupCreator';
import type { Group } from '@/lib/data-store';
import type { ExcelRow } from '@/types';

interface CreateSubGroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentGroup: Group;
  hierarchyConfig: string[];
  data: ExcelRow[];
  onCreateGroups: (groups: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>[]) => void;
}

export function CreateSubGroupsModal({
  isOpen,
  onClose,
  parentGroup,
  hierarchyConfig,
  data,
  onCreateGroups,
}: CreateSubGroupsModalProps) {
  const [selectedIndicators, setSelectedIndicators] = useState<Set<string>>(
    new Set(parentGroup.indicators.map(i => i.name))
  );
  const [namePrefix, setNamePrefix] = useState('');
  const [includeFilters, setIncludeFilters] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const subGroupCreator = useSubGroupCreator({
    parentGroup,
    hierarchyConfig,
    data,
  });

  const { nextLevel, nextLevelValues, canCreateSubGroups, getCurrentLevel } = subGroupCreator;
  const currentLevel = getCurrentLevel();

  // Генерируем превью групп
  const previewGroups = useMemo(() => {
    if (!canCreateSubGroups) return [];
    
    const selectedIndicatorNames = Array.from(selectedIndicators);
    const groups = subGroupCreator.createSubGroups(
      selectedIndicatorNames,
      namePrefix,
      includeFilters
    );
    
    return groups.slice(0, 10).map((group, index) => ({
      name: group.name,
      value: nextLevelValues[index],
      indicatorCount: selectedIndicators.size,
      filterCount: group.filters.length + Object.keys(group.hierarchyFilters || {}).length
    }));
  }, [canCreateSubGroups, selectedIndicators, namePrefix, includeFilters, subGroupCreator, nextLevelValues]);

  const handleCreate = async () => {
    if (!canCreateSubGroups || selectedIndicators.size === 0) return;

    setIsCreating(true);
    try {
      const selectedIndicatorNames = Array.from(selectedIndicators);
      const groupsToCreate = subGroupCreator.createSubGroups(
        selectedIndicatorNames,
        namePrefix,
        includeFilters
      );

      onCreateGroups(groupsToCreate);
      onClose();
    } catch (error) {
      console.error('Ошибка создания подгрупп:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const toggleIndicator = (indicatorName: string) => {
    const newSelected = new Set(selectedIndicators);
    if (newSelected.has(indicatorName)) {
      newSelected.delete(indicatorName);
    } else {
      newSelected.add(indicatorName);
    }
    setSelectedIndicators(newSelected);
  };

  const toggleAllIndicators = () => {
    if (selectedIndicators.size === parentGroup.indicators.length) {
      setSelectedIndicators(new Set());
    } else {
      setSelectedIndicators(new Set(parentGroup.indicators.map(i => i.name)));
    }
  };

  if (!isOpen) return null;

  if (!canCreateSubGroups) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card
          title="Создание подгрупп"
          rightBadge={
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          }
          className="w-full max-w-md"
        >
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Невозможно создать подгруппы
            </h3>
            <div className="space-y-2 text-gray-600">
              {hierarchyConfig.length === 0 ? (
                <p>Не настроена иерархическая структура данных</p>
              ) : !currentLevel ? (
                <p>Группа не имеет иерархических фильтров</p>
              ) : (
                <p>Группа находится на последнем уровне иерархии &quot;{nextLevel || currentLevel}&quot;</p>
              )}
            </div>
            
            {hierarchyConfig.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-800">
                  <strong>Иерархия:</strong> {hierarchyConfig.join(' → ')}
                </div>
                {currentLevel && (
                  <div className="text-sm text-blue-600 mt-1">
                    <strong>Текущий уровень:</strong> {currentLevel}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <Card
          title="Создание подгрупп"
          subtitle={
            <div className="flex items-center gap-2">
              <span>{nextLevelValues.length} групп для уровня &quot;{nextLevel}&quot;</span>
              {currentLevel && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  Из: {currentLevel}
                </span>
              )}
            </div>
          }
          rightBadge={
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" disabled={isCreating}>
              <X className="w-5 h-5" />
            </button>
          }
        >
          <div className="space-y-6">
            {/* Информационная панель */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Будет создано {nextLevelValues.length} подгрупп</p>
                <p>
                  Каждая подгруппа будет содержать все фильтры родительской группы плюс 
                  фильтр по &quot;{nextLevel}&quot;. Выберите, какие показатели копировать.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Левая колонка - настройки */}
              <div className="space-y-6">
                {/* Настройки имени */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Префикс названия (опционально)
                  </label>
                  <input
                    type="text"
                    value={namePrefix}
                    onChange={(e) => setNamePrefix(e.target.value)}
                    placeholder={parentGroup.name}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isCreating}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Пример: &quot;{namePrefix || parentGroup.name} - {nextLevelValues[0] || 'Значение'}&quot;
                  </p>
                </div>

                {/* Настройки фильтров */}
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={includeFilters}
                      onChange={(e) => setIncludeFilters(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      disabled={isCreating}
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Копировать дополнительные фильтры ({parentGroup.filters.length})
                    </span>
                  </label>
                  <p className="mt-1 text-xs text-gray-500 ml-6">
                    Иерархические фильтры копируются всегда
                  </p>
                </div>

                {/* Выбор показателей */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-700">
                      Показатели для копирования
                    </h3>
                    <button
                      onClick={toggleAllIndicators}
                      className="text-xs text-blue-600 hover:text-blue-700"
                      disabled={isCreating}
                    >
                      {selectedIndicators.size === parentGroup.indicators.length ? 'Снять все' : 'Выбрать все'}
                    </button>
                  </div>
                  
                  <div className="text-xs text-gray-500 mb-2">
                    {selectedIndicators.size} из {parentGroup.indicators.length} выбрано
                  </div>
                  
                  <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {parentGroup.indicators.map((indicator) => (
                      <label
                        key={indicator.name}
                        className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIndicators.has(indicator.name)}
                          onChange={() => toggleIndicator(indicator.name)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
                          disabled={isCreating}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {indicator.name}
                          </div>
                          <code className="text-xs text-gray-600 break-all">
                            {indicator.formula}
                          </code>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Правая колонка - превью */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-700">
                    Превью создаваемых групп
                  </h3>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="flex items-center text-sm text-blue-600 hover:text-blue-700"
                  >
                    {showPreview ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    {showPreview ? 'Скрыть' : 'Показать'}
                  </button>
                </div>

                {showPreview && (
                  <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                    <div className="space-y-2">
                      {previewGroups.map((group, index) => (
                        <div key={index} className="bg-white rounded p-3 shadow-sm">
                          <div className="font-medium text-sm text-gray-900 mb-1">
                            {group.name}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-600">
                            <span className="flex items-center gap-1">
                              <Layers className="w-3 h-3" />
                              {group.indicatorCount} показателей
                            </span>
                            <span>{group.filterCount} фильтров</span>
                          </div>
                        </div>
                      ))}
                      {nextLevelValues.length > 10 && (
                        <div className="text-xs text-gray-500 text-center py-2">
                          +{nextLevelValues.length - 10} групп еще...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!showPreview && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-center text-gray-600">
                      <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Нажмите &quot;Показать&quot; для просмотра превью</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Кнопки действий */}
            <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isCreating}
              >
                Отмена
              </button>
              <button
                onClick={handleCreate}
                disabled={selectedIndicators.size === 0 || isCreating}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isCreating ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Создание...
                  </>
                ) : (
                  <>
                    <Layers className="w-4 h-4" />
                    Создать {nextLevelValues.length} групп
                  </>
                )}
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}