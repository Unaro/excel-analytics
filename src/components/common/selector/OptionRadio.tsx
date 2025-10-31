// src/components/common/selector/OptionRadio.tsx
export function OptionRadio({
  label,
  name,
  checked,
  onChange,
  className = '',
}: {
  label: string;
  name: string;
  checked: boolean;
  onChange: () => void;
  className?: string;
}) {
  return (
    <label
      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
        checked ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
      } ${className}`}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="w-4 h-4" />
      <span className="font-medium text-gray-900">{label}</span>
    </label>
  );
}
