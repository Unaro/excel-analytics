'use client';

import { Check } from 'lucide-react';
import type { Group } from '@/lib/data-store';

interface GroupSelectionPanelProps {
  groups: Group[];
  selectedGroupIds: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  title: string;
  subtitle?: string;
  minGroups?: number;
}

export function GroupSelectionPanel({
  groups,
  selectedGroupIds,
  onToggle,
  onSelectAll,
  onClearAll,
  title,
  subtitle,
  minGroups = 1,
}: GroupSelectionPanelProps): React.ReactNode {
  const selectedCount = selectedGroupIds.length;
  const isSatisfied = selectedCount >= minGroups;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      {/* Заголовок с счетчиком */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-sm font-medium ${
              isSatisfied ? 'text-green-600' : 'text-gray-600'
            }`}
          >
            {selectedCount}/{groups.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onSelectAll}
              className="text-sm px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
            >
              Все
            </button>
            <button
              onClick={onClearAll}
              className="text-sm px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
            >
              Очистить
            </button>
          </div>
        </div>
      </div>

      {/* Сетка групп */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {groups.map((group) => {
          const isSelected = selectedGroupIds.includes(group.id);
          const indicatorCount = group.indicators?.length ?? 0;  // ← Safe access
          
          return (
            <label
              key={group.id}
              className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                isSelected
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(group.id)}
                className="w-4 h-4"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{group.name}</p>
                <p className="text-xs text-gray-500">
                  {indicatorCount} показателей  {/* ← Используй переменную */}
                </p>
              </div>
              {isSelected && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
            </label>
          );
        })}
      </div>
    </div>
  );
}
