'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  MoreVertical, 
  Edit, 
  Trash2, 
  Copy, 
  ExternalLink,
  Layers,
  Filter,
  Database
} from 'lucide-react';
import type { Group } from '@/lib/data-store';

interface GroupCardProps {
  group: Group;
  onEdit: (group: Group) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export function GroupCard({ group, onEdit, onDelete, onDuplicate }: GroupCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const filterCount = group.filters.length + 
    (group.hierarchyFilters ? Object.keys(group.hierarchyFilters).length : 0);

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 hover:border-blue-300 transition-colors p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <Link 
            href={`/dashboard/group/${group.id}`}
            className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors flex items-center group"
          >
            {group.name}
            <ExternalLink className="w-4 h-4 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
          {group.description && (
            <p className="text-sm text-gray-600 mt-1">{group.description}</p>
          )}
        </div>

        {/* Меню действий */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <MoreVertical className="w-5 h-5 text-gray-500" />
          </button>

          {menuOpen && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                <button
                  onClick={() => {
                    onEdit(group);
                    setMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Редактировать
                </button>
                <button
                  onClick={() => {
                    onDuplicate(group.id);
                    setMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Дублировать
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Удалить группу "${group.name}"?`)) {
                      onDelete(group.id);
                    }
                    setMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Удалить
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-lg font-bold text-gray-900">{group.indicators.length}</div>
          <div className="text-xs text-gray-500">Показателей</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <Filter className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-lg font-bold text-gray-900">{filterCount}</div>
          <div className="text-xs text-gray-500">Фильтров</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <Database className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {new Date(group.createdAt).toLocaleDateString('ru-RU')}
          </div>
        </div>
      </div>
    </div>
  );
}
