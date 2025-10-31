// src/components/common/form/FormActions.tsx
export function FormActions({
  primaryLabel,
  onPrimary,
  onCancel,
  disabled,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex space-x-3 pt-4">
      <button
        onClick={onPrimary}
        disabled={disabled}
        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
      >
        {primaryLabel}
      </button>
      <button
        onClick={onCancel}
        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
      >
        Отмена
      </button>
    </div>
  );
}
