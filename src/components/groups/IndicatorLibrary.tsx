'use client';

import { useState, useMemo } from 'react';
import { Search, Plus, Trash2, BookOpen } from 'lucide-react';
import { SimpleEmptyState } from '@/components/common/SimpleEmptyState';
import type { Indicator } from '@/lib/data-store';

interface IndicatorLibraryProps {
  indicators: Indicator[];
  onAddToGroup: (indicator: Indicator) => void;
  onDelete: (name: string) => void;
  onCreateNew: () => void;
}

export function IndicatorLibrary({ 
  indicators, 
  onAddToGroup, 
  onDelete,
  onCreateNew 
}: IndicatorLibraryProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredIndicators = useMemo(() => {
    if (!searchTerm) return indicators;
    
    const term = searchTerm.toLowerCase();
    return indicators.filter(ind =>
      ind.name.toLowerCase().includes(term) ||
      ind.formula.toLowerCase().includes(term)
    );
  }, [indicators, searchTerm]);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <BookOpen className="w-5 h-5 text-purple-500 mr-2" />
          <h3 className="text-lg font-semibold">Библиотека показателей</h3>
        </div>
        <button
          onClick={onCreateNew}
          className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center"
        >
          <Plus className="w-4 h-4 mr-1" />
          Создать
        </button>
      </div>

      {indicators.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск показателей..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      )}

      {filteredIndicators.length > 0 ? (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredIndicators.map((indicator) => (
            <div
              key={indicator.name}
              className="p-3 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 mb-1">{indicator.name}</h4>
                  <code className="text-xs bg-gray-50 px-2 py-1 rounded text-gray-700 block break-all">
                    {indicator.formula}
                  </code>
                </div>
                <div className="flex items-center space-x-1 ml-2">
                  <button
                    onClick={() => onAddToGroup(indicator)}
                    className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                    title="Добавить в группу"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Удалить показатель "${indicator.name}" из библиотеки?`)) {
                        onDelete(indicator.name);
                      }
                    }}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                    title="Удалить"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : indicators.length > 0 ? (
        <SimpleEmptyState
          icon={Search}
          title="Показатели не найдены"
          description="Попробуйте изменить поисковый запрос"
        />
      ) : (
        <SimpleEmptyState
          icon={BookOpen}
          title="Библиотека пуста"
          description="Создайте первый показатель для переиспользования"
        />
      )}
    </div>
  );
}
