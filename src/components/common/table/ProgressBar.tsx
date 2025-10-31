// src/components/common/table/ProgressBar.tsx
export function ProgressBar({ value, color }: { value: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${clamped}%`, backgroundColor: color }}
      />
    </div>
  );
}
