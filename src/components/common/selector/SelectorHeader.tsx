// src/components/common/selector/SelectorHeader.tsx
import { ReactNode } from 'react';

export function SelectorHeader({
  title,
  subtitle,
  right,
}: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}
