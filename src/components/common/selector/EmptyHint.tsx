// src/components/common/selector/EmptyHint.tsx
import { AlertCircle } from 'lucide-react';

export function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg text-gray-600">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
