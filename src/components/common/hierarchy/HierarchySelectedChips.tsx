// src/components/common/hierarchy/HierarchySelectedChips.tsx (исправление)
import { X } from 'lucide-react';

export function HierarchySelectedChips({
  values,
  onRemove,
  onClearAll,
}: {
  values: Array<string | number>;
  onRemove: (value: string | number) => void;
  onClearAll?: () => void;
}) {
  // Проверяем, что values - это массив
  if (!Array.isArray(values) || values.length === 0) return null;

  return (
    <div className="flex items-center flex-wrap gap-2">
      {values.map((v) => (
        <span
          key={String(v)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 text-purple-800 text-sm"
        >
          {String(v)}
          <button
            onClick={() => onRemove(v)}
            className="p-0.5 hover:bg-purple-200 rounded transition-colors"
            aria-label="Удалить значение"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      {onClearAll && (
        <button
          onClick={onClearAll}
          className="text-sm text-purple-700 hover:text-purple-800 ml-2"
        >
          Очистить все
        </button>
      )}
    </div>
  );
}
