'use client';

import { Play, Trash2, Edit2, Copy, Clock } from 'lucide-react';

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  createdAt: number;
  lastUsed?: number;
  usageCount: number;
}

interface SavedQueriesProps {
  queries: SavedQuery[];
  onLoad: (query: SavedQuery) => void;
  onDelete: (id: string) => void;
  onEdit?: (query: SavedQuery) => void;
}

export default function SavedQueries({ queries, onLoad, onDelete, onEdit }: SavedQueriesProps) {
  if (queries.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <p className="text-gray-500">Нет сохранённых запросов</p>
        <p className="text-sm text-gray-400 mt-1">Выполните запрос и сохраните его</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Сохранённые запросы</h3>
      <div className="space-y-3">
        {queries
          .sort((a, b) => (b.lastUsed || b.createdAt) - (a.lastUsed || a.createdAt))
          .map((query) => (
            <div
              key={query.id}
              className="group border-2 border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1">{query.name}</h4>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(query.createdAt).toLocaleDateString('ru-RU')}
                    </span>
                    <span>Использован {query.usageCount}x</span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onLoad(query)}
                    className="p-1.5 hover:bg-green-100 rounded transition-colors"
                    title="Загрузить"
                  >
                    <Play size={14} className="text-green-600" />
                  </button>
                  {onEdit && (
                    <button
                      onClick={() => onEdit(query)}
                      className="p-1.5 hover:bg-blue-100 rounded transition-colors"
                      title="Редактировать"
                    >
                      <Edit2 size={14} className="text-blue-600" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(query.sql);
                      alert('SQL скопирован!');
                    }}
                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                    title="Копировать"
                  >
                    <Copy size={14} className="text-gray-600" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Удалить этот запрос?')) {
                        onDelete(query.id);
                      }
                    }}
                    className="p-1.5 hover:bg-red-100 rounded transition-colors"
                    title="Удалить"
                  >
                    <Trash2 size={14} className="text-red-600" />
                  </button>
                </div>
              </div>
              <pre className="text-xs bg-gray-900 text-green-400 p-2 rounded font-mono overflow-x-auto">
                {query.sql}
              </pre>
            </div>
          ))}
      </div>
    </div>
  );
}
