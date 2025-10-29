import { Check } from 'lucide-react';

interface Group {
  id: string;
  name: string;
}

interface GroupSelectorProps {
  groups: Group[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

export default function GroupSelector({
  groups,
  selectedIds,
  onToggle,
  onSelectAll,
  onClearAll,
}: GroupSelectorProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">
          Выберите группы для сравнения
        </h3>
        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Выбрать все
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={onClearAll}
            className="text-sm text-gray-600 hover:text-gray-700 font-medium"
          >
            Снять все
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-2">
        {groups.map((group) => {
          const isSelected = selectedIds.includes(group.id);

          return (
            <button
              key={group.id}
              onClick={() => onToggle(group.id)}
              className={`
                relative p-4 rounded-lg border-2 transition-all text-left
                ${isSelected
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }
              `}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`font-medium ${
                  isSelected ? 'text-blue-900' : 'text-gray-900'
                }`}>
                  {group.name}
                </span>
                {isSelected && (
                  <div className="flex-shrink-0 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                    <Check size={14} className="text-white" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedIds.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Выбрано:</strong> {selectedIds.length} из {groups.length} групп
          </p>
        </div>
      )}
    </div>
  );
}
