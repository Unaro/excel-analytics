'use client';

import { ChevronRight } from 'lucide-react';
import type { HierarchyFilters } from '@/types';

interface HierarchyDisplayProps {
  hierarchy: HierarchyFilters;  // Record<string, string>
  className?: string;
}

export function HierarchyDisplay({ hierarchy, className = '' }: HierarchyDisplayProps) {
  const entries = Object.entries(hierarchy);
  
  if (entries.length === 0) {
    return (
      <p className="text-sm text-gray-500">Нет иерархических фильтров</p>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Визуальная иерархия с стрелками */}
      <div className="flex items-center flex-wrap gap-2">
        {entries.map(([key, value], index) => (
          <div key={key} className="flex items-center">
            {index > 0 && (
              <ChevronRight className="w-4 h-4 text-gray-400 mx-2" />
            )}
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <div className="text-xs text-blue-600 font-medium mb-0.5">{key}</div>
              <div className="text-sm text-blue-900 font-semibold">{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Детальный список */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-start text-sm">
            <span className="font-medium text-gray-700 min-w-[200px]">{key}:</span>
            <span className="text-gray-900 break-all">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
