// src/components/common/hierarchy/HierarchyLevelSelect.tsx
export function HierarchyLevelSelect({
  levels,
  selectedLevel,
  onChange,
}: {
  levels: string[];
  selectedLevel: string | null;
  onChange: (level: string) => void;
}) {
  return (
    <select
      value={selectedLevel ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full md:w-80 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
    >
      <option value="" disabled>Выберите уровень иерархии...</option>
      {levels.map((lvl) => (
        <option key={lvl} value={lvl}>{lvl}</option>
      ))}
    </select>
  );
}
