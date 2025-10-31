// src/components/common/filters/HintBox.tsx
export function HintBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
      {children}
    </div>
  );
}
