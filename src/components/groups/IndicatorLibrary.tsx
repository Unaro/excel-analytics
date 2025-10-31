'use client';

import { useState, useMemo } from 'react';
import { Search, Plus, Trash2, BookOpen, AlertCircle } from 'lucide-react';
import type { Indicator } from '@/lib/data-store';

interface IndicatorLibraryProps {
  indicators: Indicator[];
  onDelete?: (name: string) => void;
  onAddToGroup?: (indicator: Indicator) => void;
  onCreateNew?: () => void;
  
  /**
   * Режим использования:
   * - 'standalone': только просмотр и удаление (для вкладки библиотеки)
   * - 'grouped': с кнопкой добавления в группу (для GroupForm)
   * @default 'standalone'
   */
  mode?: 'standalone' | 'grouped';
}

export function IndicatorLibrary({
  indicators,
  onDelete,
  onAddToGroup,
  onCreateNew,
  mode = 'standalone',
}: IndicatorLibraryProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Валидация функций в зависимости от режима
  const isStandalone = mode === 'standalone';
  
  if (isStandalone && !onDelete) {
    console.warn('IndicatorLibrary: В режиме standalone требуется onDelete');
  }
  
  if (!isStandalone && !onAddToGroup) {
    console.warn('IndicatorLibrary: В режиме grouped требуется onAddToGroup');
  }

  const filteredIndicators = useMemo(() => {
    if (!searchTerm) return indicators;
    const term = searchTerm.toLowerCase();
    return indicators.filter(
      (ind) =>
        ind.name.toLowerCase().includes(term) ||
        ind.formula.toLowerCase().includes(term)
    );
  }, [indicators, searchTerm]);

  // Empty state
  if (indicators.length === 0) {
    return (
      <div className="text-center py-12">
        <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 mb-4">Библиотека показателей пуста</p>
        {!isStandalone && onCreateNew && (
          <button
            onClick={onCreateNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Создать первый показатель
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Заголовок и кнопка создания */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по названию или формуле..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        {/* Кнопка создания только в grouped режиме */}
        {isStandalone && onCreateNew && (
          <button
            onClick={onCreateNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </button>
        )}
      </div>

      {/* Список показателей */}
      {filteredIndicators.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Показатели не найдены</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIndicators.map((indicator) => (
            <div
              key={indicator.name}
              className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 truncate">
                    {indicator.name}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1 break-all font-mono bg-gray-50 p-2 rounded">
                    {indicator.formula}
                  </p>
                </div>

                {/* Действия в зависимости от режима */}
                <div className="flex gap-2 flex-shrink-0">

                  {/* Grouped: добавление в группу */}
                  {!isStandalone && onAddToGroup && (
                    <button
                      onClick={() => onAddToGroup(indicator)}
                      className="px-3 py-2 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg transition-colors"
                      title="Добавить в группу"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}

                  {/* Standalone: удаление */}
                  {isStandalone && onDelete && (
                    <button
                      onClick={() => onDelete(indicator.name)}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Удалить показатель"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
