// src/components/common/hierarchy/HierarchyHeader.tsx
import { Layers } from 'lucide-react';

export function HierarchyHeader({
  title,
  subtitle,
}: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center mb-4">
      <Layers className="w-5 h-5 text-purple-500 mr-2" />
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
      </div>
    </div>
  );
}
