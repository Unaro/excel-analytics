// src/components/sql/SavedQueries.tsx (обновленная версия)
'use client';

import { useState } from 'react';
import { Clock, Trash2, Play, Edit } from 'lucide-react';
import type { SavedQuery } from '@/types/sql'; // используем общий тип
import { SimpleEmptyState } from '@/components/common/SimpleEmptyState';

interface SavedQueriesProps {
  queries: SavedQuery[];
  onLoad: (query: SavedQuery) => void;
  onDelete: (id: string) => void;
  onEdit?: (id: string, changes: { name: string; sql: string }) => void;
}

export default function SavedQueries({ 
  queries, 
  onLoad, 
  onDelete, 
  onEdit 
}: SavedQueriesProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleStartEdit = (query: SavedQuery) => {
    setEditingId(query.id);
    setEditName(query.name);
  };

  const handleSaveEdit = (query: SavedQuery) => {
    if (onEdit && editName.trim() && editName !== query.name) {
      onEdit(query.id, { name: editName.trim(), sql: query.sql });
    }
    setEditingId(null);
    setEditName('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  if (queries.length === 0) {
    return (
      <SimpleEmptyState
        icon={Clock}
        title="Нет сохраненных запросов"
        description="Сохраните запрос, чтобы использовать его позже"
      />
    );
  }

  // Сортируем по последнему использованию
  const sortedQueries = [...queries].sort((a, b) => b.lastUsed - a.lastUsed);

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {sortedQueries.map((query) => (
        <div
          key={query.id}
          className="p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            {editingId === query.id ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => handleSaveEdit(query)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit(query);
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            ) : (
              <div className="flex-1 min-w-0">
                <h4 
                  className="font-medium text-gray-900 text-sm truncate cursor-pointer"
                  onClick={() => handleStartEdit(query)}
                  title={query.name}
                >
                  {query.name}
                </h4>
              </div>
            )}

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => onLoad(query)}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Загрузить запрос"
              >
                <Play className="w-3.5 h-3.5" />
              </button>
              
              {onEdit && editingId !== query.id && (
                <button
                  onClick={() => handleStartEdit(query)}
                  className="p-1.5 text-gray-600 hover:bg-gray-50 rounded transition-colors"
                  title="Переименовать"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                onClick={() => onDelete(query.id)}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Удалить"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Превью SQL */}
          <code className="text-xs bg-gray-50 px-2 py-1 rounded text-gray-700 block truncate mb-2">
            {query.sql}
          </code>

          {/* Метаданные */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              Создан: {formatDate(query.createdAt)}
            </span>
            <div className="flex items-center gap-3">
              <span>
                Использований: {query.usageCount}
              </span>
              <span>
                Последний раз: {formatDate(query.lastUsed)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
