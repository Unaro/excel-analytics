// src/components/common/ToggleTabs.tsx
export function ToggleTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; count?: number; icon?: React.ReactNode }>;
}) {
  return (
    <div className="flex gap-2 border-b border-gray-200 pb-4">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.icon}
            <span className={opt.icon ? 'ml-2' : ''}>
              {opt.label}
              {typeof opt.count === 'number' ? ` (${opt.count})` : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
