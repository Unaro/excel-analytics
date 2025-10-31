// src/components/common/hierarchy/HierarchyValuesList.tsx (исправление)
export function HierarchyValuesList({
  values,
  selected,
  onToggle,
}: {
  values: Array<string | number>;
  selected: Array<string | number>;
  onToggle: (value: string | number) => void;
}) {
  if (!Array.isArray(values) || values.length === 0) {
    return <p className="text-sm text-gray-500">Нет значений для выбранного уровня</p>;
  }

  // Обеспечиваем, что selected тоже массив
  const selectedArray = Array.isArray(selected) ? selected : [];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
      {values.map((v) => {
        const isSelected = selectedArray.includes(v);
        return (
          <button
            key={String(v)}
            onClick={() => onToggle(v)}
            className={`px-3 py-2 rounded-lg border text-sm transition-colors text-left ${
              isSelected
                ? 'border-purple-300 bg-purple-50 text-purple-700'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            {String(v)}
          </button>
        );
      })}
    </div>
  );
}
