// src/components/groups/CreateSubGroupsModal.tsx
'use client';

import { useState, useMemo } from 'react';
import { X, Layers, Check, AlertCircle } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { useSubGroupCreator } from '@/hooks/useSubGroupCreator';
import type { Group, Indicator } from '@/lib/data-store';
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

  const subGroupCreator = useSubGroupCreator({
    parentGroup,
    hierarchyConfig,
    data,
  });

  const { nextLevel, values: nextLevelValues } = subGroupCreator.getNextLevelValues();

  const previewGroups = useMemo(() => {
    if (!nextLevel || nextLevelValues.length === 0) return [];
    
    return nextLevelValues.slice(0, 5).map(value => ({
      name: `${namePrefix || parentGroup.name} - ${value}`,
      value,
      indicatorCount: selectedIndicators.size,
    }));
  }, [nextLevel, nextLevelValues, namePrefix, parentGroup.name, selectedIndicators.size]);

  const handleCreate = () => {
    if (!nextLevel || nextLevelValues.length === 0) return;

    const groupsToCreate = nextLevelValues.map(value => {
      const selectedIndicatorObjects = parentGroup.indicators.filter(
        indicator => selectedIndicators.has(indicator.name)
      );

      return {
        name: `${namePrefix || parentGroup.name} - ${value}`,
        description: `Автосоздано из "${parentGroup.name}" для ${nextLevel}: ${value}`,
        hierarchyFilters: {
          ...parentGroup.hierarchyFilters,
          [nextLevel]: value,
        },
        filters: includeFilters ? [...parentGroup.filters] : [],
        indicators: selectedIndicatorObjects,
      };
    });

    onCreateGroups(groupsToCreate);
    onClose();
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

  if (!isOpen) return null;

  if (!nextLevel || nextLevelValues.length === 0) {
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
            <p className="text-gray-600">
              Группа находится на последнем уровне иерархии или не имеет иерархических фильтров
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <Card
          title="Создание подгрупп"
          subtitle={`${nextLevelValues.length} групп для уровня "${nextLevel}"`}
          rightBadge={
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          }
        >
          <div className="space-y-6">
            {/* Настройки */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                />
              </div>
              
              <div>
                <label className="flex items-center space-x-2 pt-8">
                  <input
                    type="checkbox"
                    checked={includeFilters}
                    onChange={(e) => setIncludeFilters(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    Копировать дополнительные фильтры
                  </span>
                </label>
              </div>
            </div>

            {/* Выбор показателей */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Показатели для копирования ({selectedIndicators.size} из {parentGroup.indicators.length})
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
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
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
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

            {/* Превью */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Превью создаваемых групп
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                {previewGroups.map((group, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {group.name}
                    </span>
                    <span className="text-xs text-gray-600">
                      {group.indicatorCount} показателей
                    </span>
                  </div>
                ))}
                {nextLevelValues.length > 5 && (
                  <div className="text-xs text-gray-500 text-center pt-2">
                    +{nextLevelValues.length - 5} групп еще...
                  </div>
                )}
              </div>
            </div>

            {/* Кнопки */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleCreate}
                disabled={selectedIndicators.size === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Layers className="w-4 h-4" />
                Создать {nextLevelValues.length} групп
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
