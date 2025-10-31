// src/components/common/filters/FilterRow.tsx
import { X } from 'lucide-react';

export function FilterRow({
  columnControl,
  operatorControl,
  valueControl,
  onRemove,
}: {
  columnControl: React.ReactNode;
  operatorControl: React.ReactNode;
  valueControl: React.ReactNode;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
      <div className="flex-1 min-w-0">{columnControl}</div>
      {operatorControl}
      {valueControl}
      <button
        onClick={onRemove}
        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
