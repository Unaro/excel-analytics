// src/components/common/filters/FilterToolbar.tsx
import { Filter as FilterIcon, Plus } from 'lucide-react';

export function FilterToolbar({
  count,
  onAdd,
  onClearAll,
}: { count: number; onAdd: () => void; onClearAll?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <FilterIcon className="w-4 h-4 text-gray-500 mr-2" />
        <span className="text-sm text-gray-600">
          {count === 0 ? 'Фильтры не применены' : `Применено фильтров: ${count}`}
        </span>
      </div>
      <div className="flex items-center space-x-2">
        {count > 0 && onClearAll && (
          <button onClick={onClearAll} className="text-sm text-red-600 hover:text-red-700">
            Очистить все
          </button>
        )}
        <button
          onClick={onAdd}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus className="w-4 h-4 mr-1" />
          Добавить фильтр
        </button>
      </div>
    </div>
  );
}
