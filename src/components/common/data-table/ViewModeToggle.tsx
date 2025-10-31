// src/components/common/data-table/ViewModeToggle.tsx
'use client';

import { List, Grid } from 'lucide-react';

export type ViewMode = 'table' | 'cards';

interface ViewModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  availableModes?: ViewMode[];
}

export function ViewModeToggle({ 
  mode, 
  onChange, 
  availableModes = ['table', 'cards'] 
}: ViewModeToggleProps) {
  const modeConfig = {
    table: { icon: List, title: 'Таблица' },
    cards: { icon: Grid, title: 'Карточки' }
  };

  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {availableModes.map((availableMode) => {
        const { icon: Icon, title } = modeConfig[availableMode];
        return (
          <button
            key={availableMode}
            onClick={() => onChange(availableMode)}
            className={`px-3 py-1.5 rounded transition-colors ${
              mode === availableMode ? 'bg-white shadow' : 'hover:bg-gray-200'
            }`}
            title={title}
          >
            <Icon size={18} />
          </button>
        );
      })}
    </div>
  );
}
