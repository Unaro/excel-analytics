// src/components/common/filters/OperatorSelect.tsx
import type { FilterCondition } from '@/types';

const OPERATORS: Array<{ value: FilterCondition['operator']; label: string }> = [
  { value: '=', label: 'Равно' },
  { value: '!=', label: 'Не равно' },
  { value: '>', label: 'Больше' },
  { value: '<', label: 'Меньше' },
  { value: '>=', label: 'Больше или равно' },
  { value: '<=', label: 'Меньше или равно' },
  { value: 'contains', label: 'Содержит' },
];

export function OperatorSelect({
  value,
  onChange,
}: { value: FilterCondition['operator']; onChange: (v: FilterCondition['operator']) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as FilterCondition['operator'])}
      className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
    >
      {OPERATORS.map((op) => (
        <option key={op.value} value={op.value}>
          {op.label}
        </option>
      ))}
    </select>
  );
}
