'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { SimpleEmptyState } from '@/components/common/SimpleEmptyState';
import EmptyState from '@/components/dashboard/EmptyState';
import { HierarchyDisplay } from '@/components/common/HierarchyDisplay';
import { IndicatorsList } from '@/components/common/IndicatorList';
import { 
  ArrowLeft, 
  AlertCircle, 
  Filter, 
  Layers, 
  Calendar,
  Database
} from 'lucide-react';
import Link from 'next/link';
import { dataStore } from '@/lib/data-store';
import type { GroupWithData } from '@/lib/data-store';
import type { FilterCondition } from '@/types';

export default function GroupDetailPage() {
  const params = useParams();
  const groupId = params.id as string;
  const [groupWithData, setGroupWithData] = useState<GroupWithData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const data = dataStore.getGroupWithData(groupId);
    setGroupWithData(data);
    setLoading(false);
  }, [groupId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!groupWithData) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <EmptyState
          icon={AlertCircle}
          title="Группа не найдена"
          description="Возможно, она была удалена"
          actionLabel="Вернуться к группам"
          actionHref="/groups"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Навигация назад */}
      <Link 
        href="/groups"
        className="inline-flex items-center text-blue-600 hover:text-blue-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Назад к группам
      </Link>

      {/* Заголовок */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">{groupWithData.name}</h1>
        {groupWithData.description && (
          <p className="text-blue-100">{groupWithData.description}</p>
        )}
        
        <div className="mt-4 flex items-center space-x-6 text-sm text-blue-100">
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-1" />
            <span>Создано: {new Date(groupWithData.createdAt).toLocaleDateString('ru-RU')}</span>
          </div>
          <div className="flex items-center">
            <Database className="w-4 h-4 mr-1" />
            <span>{groupWithData.rowCount.toLocaleString()} строк</span>
          </div>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-500">Показателей</div>
            <Layers className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {groupWithData.indicators.length}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-500">Строк данных</div>
            <Database className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {groupWithData.rowCount.toLocaleString()}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-500">Обычных фильтров</div>
            <Filter className="w-5 h-5 text-orange-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {groupWithData.filters.length}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-500">Уровней иерархии</div>
            <Filter className="w-5 h-5 text-purple-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {groupWithData.hierarchyFilters ? Object.keys(groupWithData.hierarchyFilters).length : 0}
          </div>
        </div>
      </div>

      {/* Иерархическая структура */}
      {groupWithData.hierarchyFilters && Object.keys(groupWithData.hierarchyFilters).length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <Filter className="w-5 h-5 text-purple-500 mr-2" />
            <h2 className="text-xl font-semibold">Иерархическая структура</h2>
          </div>
          <HierarchyDisplay hierarchy={groupWithData.hierarchyFilters} />
        </div>
      )}

      {/* Показатели */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <Layers className="w-5 h-5 text-blue-500 mr-2" />
          <h2 className="text-xl font-semibold">Показатели</h2>
        </div>
        
        {groupWithData.indicators.length > 0 ? (
          <IndicatorsList indicators={groupWithData.indicators} />
        ) : (
          <SimpleEmptyState
            icon={Layers}
            title="Нет показателей"
            description="Добавьте показатели для анализа данных этой группы"
          />
        )}
      </div>

      {/* Обычные фильтры */}
      {groupWithData.filters.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <Filter className="w-5 h-5 text-orange-500 mr-2" />
            <h2 className="text-xl font-semibold">Фильтры условий</h2>
          </div>
          <div className="space-y-2">
            {groupWithData.filters.map((filter: FilterCondition) => (
              <div 
                key={filter.id} 
                className="flex items-center p-3 bg-gray-50 rounded-lg"
              >
                <span className="font-medium text-gray-700 min-w-[150px]">{filter.column}</span>
                <span className="mx-3 px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm font-mono">
                  {filter.operator}
                </span>
                <span className="text-gray-900 font-semibold">{String(filter.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Детали группы */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Информация о группе</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">ID группы</div>
            <div className="text-sm font-mono text-gray-900 break-all">{groupWithData.id}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">Создана</div>
            <div className="text-sm text-gray-900">
              {new Date(groupWithData.createdAt).toLocaleString('ru-RU')}
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">Обновлена</div>
            <div className="text-sm text-gray-900">
              {new Date(groupWithData.updatedAt).toLocaleString('ru-RU')}
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">Строк в выборке</div>
            <div className="text-sm text-gray-900">
              {groupWithData.rowCount.toLocaleString('ru-RU')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
