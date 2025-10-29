'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getExcelData } from '@/lib/storage';
import { applyFilters, evaluateFormula } from '@/lib/excel-parser';
import { SheetData } from '@/types';
import { 
  ArrowLeft,
  Calendar,
  Filter as FilterIcon,
  Layers,
  TrendingUp,
  BarChart3,
  Download,
  Edit2,
  Copy,
  Trash2,
  AlertCircle,
  FileSpreadsheet,
  Hash,
} from 'lucide-react';
import Link from 'next/link';
import Loader from '@/components/loader';
import KPICard from '@/components/dashboard/KPICard';
import StatCard from '@/components/analysis/StatCard';
import ChartWrapper from '@/components/charts/ChartWrapper';
import BarChart from '@/components/charts/BarChart';
import LineChart from '@/components/charts/LineChart';
import PieChart from '@/components/charts/PieChart';
import BoxPlot from '@/components/analysis/BoxPlot';

interface Group {
  id: string;
  name: string;
  description?: string;
  filters: Array<{
    id: string;
    column: string;
    operator: string;
    value: string;
  }>;
  indicators: Array<{
    id: string;
    name: string;
    formula: string;
  }>;
  hierarchyFilters?: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [hierarchyConfig, setHierarchyConfig] = useState<string[]>([]);

  useEffect(() => {
    const data = getExcelData();
    if (data) setSheets(data);

    const savedGroups = localStorage.getItem('analyticsGroups');
    if (savedGroups) {
      const groups: Group[] = JSON.parse(savedGroups);
      const foundGroup = groups.find(g => g.id === groupId);
      setGroup(foundGroup || null);
    }

    const savedConfig = localStorage.getItem('hierarchyConfig');
    if (savedConfig) setHierarchyConfig(JSON.parse(savedConfig));

    setLoading(false);
  }, [groupId]);

  // Фильтруем данные
  const filteredData = useMemo(() => {
    if (!sheets || sheets.length === 0 || !group) return [];

    const getDeepestHierarchyFilter = (hierarchyFilters: Record<string, string> | undefined) => {
      if (!hierarchyFilters || !hierarchyConfig.length) return null;
      let deepestLevel = null;
      for (let i = hierarchyConfig.length - 1; i >= 0; i--) {
        const col = hierarchyConfig[i];
        if (hierarchyFilters[col]) {
          deepestLevel = { column: col, value: hierarchyFilters[col] };
          break;
        }
      }
      return deepestLevel;
    };

    const deepestFilter = getDeepestHierarchyFilter(group.hierarchyFilters);
    const allFilters = [
      ...group.filters,
      ...(deepestFilter ? [{
        id: 'hier_deepest',
        column: deepestFilter.column,
        operator: '=',
        value: deepestFilter.value,
      }] : []),
    ];

    return applyFilters(sheets[0].rows, allFilters);
  }, [sheets, group, hierarchyConfig]);

  // Вычисляем показатели
  const metrics = useMemo(() => {
    if (!group || filteredData.length === 0 || !sheets || sheets.length === 0) return null;

    return group.indicators.map(indicator => {
      try {
        const aggregatedValue = evaluateFormula(indicator.formula, filteredData, sheets[0].headers);
        
        // Получаем значения для статистики
        const values = filteredData
          .map(row => {
            try {
              return evaluateFormula(indicator.formula, [row], sheets[0].headers);
            } catch {
              return null;
            }
          })
          .filter((v): v is number => v !== null);

        // Статистика
        const sorted = [...values].sort((a, b) => a - b);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const median = sorted[Math.floor(sorted.length / 2)];
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);

        return {
          name: indicator.name,
          formula: indicator.formula,
          aggregatedValue,
          values,
          stats: { mean, median, min, max, stdDev, variance, count: values.length },
        };
      } catch (error) {
        return null;
      }
    }).filter((m): m is NonNullable<typeof m> => m !== null);
  }, [group, filteredData, sheets]);

  // Действия
  const handleEdit = () => {
    router.push(`/groups?edit=${groupId}`);
  };

  const handleDuplicate = () => {
    if (!group) return;
    const groups: Group[] = JSON.parse(localStorage.getItem('analyticsGroups') || '[]');
    const newGroup: Group = {
      ...group,
      id: Date.now().toString(),
      name: `${group.name} (копия)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    localStorage.setItem('analyticsGroups', JSON.stringify([...groups, newGroup]));
    alert('Группа дублирована!');
    router.push('/groups');
  };

  const handleDelete = () => {
    if (!confirm('Вы уверены, что хотите удалить эту группу?')) return;
    const groups: Group[] = JSON.parse(localStorage.getItem('analyticsGroups') || '[]');
    const filtered = groups.filter(g => g.id !== groupId);
    localStorage.setItem('analyticsGroups', JSON.stringify(filtered));
    alert('Группа удалена!');
    router.push('/dashboard/overview');
  };

  const exportData = () => {
    if (!group || !metrics) return;

    const headers = ['Показатель', 'Значение', 'Формула'];
    const rows = metrics.map(m => [m.name, m.aggregatedValue.toFixed(2), m.formula]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${group.name}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) {
    return <Loader title="Загрузка группы..." />;
  }

  if (!group) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <AlertCircle size={64} className="mx-auto text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Группа не найдена</h1>
        <p className="text-gray-600 mb-6">Возможно, она была удалена</p>
        <Link
          href="/dashboard/overview"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ArrowLeft size={18} />
          Вернуться к обзору
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Хлебные крошки */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/dashboard/overview" className="hover:text-blue-600">Обзор</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{group.name}</span>
      </div>

      {/* Заголовок с действиями */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-8 text-white">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <Link
              href="/dashboard/overview"
              className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft size={18} />
              Назад к обзору
            </Link>
            <h1 className="text-4xl font-bold mb-2">{group.name}</h1>
            {group.description && (
              <p className="text-white/90 text-lg">{group.description}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleEdit}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg flex items-center gap-2 transition-colors backdrop-blur"
          >
            <Edit2 size={18} />
            Редактировать
          </button>
          <button
            onClick={handleDuplicate}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg flex items-center gap-2 transition-colors backdrop-blur"
          >
            <Copy size={18} />
            Дублировать
          </button>
          <button
            onClick={exportData}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg flex items-center gap-2 transition-colors backdrop-blur"
          >
            <Download size={18} />
            Экспорт
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-500/80 hover:bg-red-600 rounded-lg flex items-center gap-2 transition-colors ml-auto"
          >
            <Trash2 size={18} />
            Удалить
          </button>
        </div>
      </div>

      {/* Метаинформация */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Записей в группе"
          value={filteredData.length.toLocaleString()}
          icon={FileSpreadsheet}
          color="#3b82f6"
        />
        <KPICard
          title="Показателей"
          value={group.indicators.length}
          icon={TrendingUp}
          color="#8b5cf6"
        />
        <KPICard
          title="Фильтров"
          value={group.filters.length + (group.hierarchyFilters ? Object.keys(group.hierarchyFilters).length : 0)}
          icon={FilterIcon}
          color="#10b981"
        />
        <KPICard
          title="Создана"
          value={new Date(group.createdAt).toLocaleDateString('ru-RU')}
          icon={Calendar}
          color="#f59e0b"
          subtitle={`Обновлена: ${new Date(group.updatedAt).toLocaleDateString('ru-RU')}`}
        />
      </div>

      {/* Фильтры и условия */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Обычные фильтры */}
        {group.filters.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FilterIcon size={24} className="text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                Фильтры ({group.filters.length})
              </h2>
            </div>
            <div className="space-y-2">
              {group.filters.map((filter, idx) => (
                <div
                  key={filter.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-gray-900">{filter.column}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
                      {filter.operator}
                    </span>
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded font-semibold">
                      {filter.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Иерархические фильтры */}
        {group.hierarchyFilters && Object.keys(group.hierarchyFilters).length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Layers size={24} className="text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                Иерархия ({Object.keys(group.hierarchyFilters).length})
              </h2>
            </div>
            <div className="space-y-2">
              {Object.entries(group.hierarchyFilters).map(([key, value], idx) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-gray-900">{key}</span>
                  </div>
                  <span className="px-3 py-1 bg-purple-600 text-white rounded font-semibold">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Показатели группы */}
      {metrics && metrics.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <BarChart3 size={24} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Показатели группы
            </h2>
          </div>

          {/* Карточки показателей */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics.map((metric, idx) => (
              <div
                key={metric.name}
                className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-6 border-l-4 hover:shadow-xl transition-shadow"
                style={{ borderLeftColor: `hsl(${idx * 60}, 70%, 60%)` }}
              >
                <h3 className="text-sm font-medium text-gray-600 mb-2">{metric.name}</h3>
                <p className="text-4xl font-bold text-gray-900 mb-3">
                  {metric.aggregatedValue.toFixed(2)}
                </p>
                <div className="text-xs text-gray-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Среднее:</span>
                    <span className="font-semibold">{metric.stats.mean.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Медиана:</span>
                    <span className="font-semibold">{metric.stats.median.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Разброс:</span>
                    <span className="font-semibold">
                      {metric.stats.min.toFixed(1)} - {metric.stats.max.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Детальная статистика по каждому показателю */}
          {metrics.map((metric, idx) => (
            <div key={metric.name} className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Hash size={20} className="text-blue-600" />
                {metric.name}
              </h3>

              {/* Формула */}
              <div className="mb-6 p-4 bg-gray-900 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Формула:</p>
                <code className="text-green-400 font-mono">{metric.formula}</code>
              </div>

              {/* Статистические карточки */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                <StatCard
                  label="Агрегат"
                  value={metric.aggregatedValue.toFixed(2)}
                  color="#3b82f6"
                />
                <StatCard
                  label="Среднее"
                  value={metric.stats.mean.toFixed(2)}
                  color="#8b5cf6"
                />
                <StatCard
                  label="Медиана"
                  value={metric.stats.median.toFixed(2)}
                  color="#a855f7"
                />
                <StatCard
                  label="Минимум"
                  value={metric.stats.min.toFixed(2)}
                  color="#10b981"
                />
                <StatCard
                  label="Максимум"
                  value={metric.stats.max.toFixed(2)}
                  color="#f59e0b"
                />
                <StatCard
                  label="Станд. откл."
                  value={metric.stats.stdDev.toFixed(2)}
                  description="σ"
                  color="#ef4444"
                />
              </div>

              {/* Визуализации */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Box Plot */}
                <ChartWrapper title="Распределение и выбросы">
                  <BoxPlot
                    data={metric.values}
                    label={metric.name}
                    color={`hsl(${idx * 60}, 70%, 60%)`}
                  />
                </ChartWrapper>

                {/* Гистограмма */}
                <ChartWrapper title="Гистограмма распределения">
                  {(() => {
                    const bucketCount = 10;
                    const min = metric.stats.min;
                    const max = metric.stats.max;
                    const bucketSize = (max - min) / bucketCount;

                    const histogram = Array.from({ length: bucketCount }, (_, i) => {
                      const start = min + i * bucketSize;
                      const end = start + bucketSize;
                      const count = metric.values.filter(v => v >= start && (i === bucketCount - 1 ? v <= end : v < end)).length;
                      return {
                        name: `${start.toFixed(1)}`,
                        value: count,
                      };
                    });

                    return <BarChart data={histogram} indicators="value" height={250} />;
                  })()}
                </ChartWrapper>
              </div>
            </div>
          ))}

          {/* Сравнение показателей */}
          {metrics.length > 1 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">
                Сравнение всех показателей
              </h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Столбчатая диаграмма */}
                <ChartWrapper title="Агрегированные значения">
                  <BarChart
                    data={metrics.map(m => ({
                      name: m.name,
                      value: m.aggregatedValue,
                    }))}
                    indicators="value"
                    height={300}
                  />
                </ChartWrapper>

                {/* Круговая диаграмма */}
                <ChartWrapper title="Распределение по показателям">
                  <PieChart
                    data={metrics.map(m => ({
                      name: m.name,
                      value: m.aggregatedValue,
                    }))}
                    height={300}
                  />
                </ChartWrapper>

                {/* Линейный график средних */}
                <ChartWrapper title="Средние значения">
                  <LineChart
                    data={metrics.map(m => ({
                      name: m.name,
                      value: m.stats.mean,
                    }))}
                    indicators="value"
                    height={300}
                  />
                </ChartWrapper>

                {/* Таблица статистики */}
                <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
                  <h4 className="font-bold text-gray-900 mb-3">Сводная статистика</h4>
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left">Показатель</th>
                        <th className="px-3 py-2 text-right">Среднее</th>
                        <th className="px-3 py-2 text-right">Медиана</th>
                        <th className="px-3 py-2 text-right">σ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {metrics.map(m => (
                        <tr key={m.name} className="hover:bg-gray-100">
                          <td className="px-3 py-2 font-medium">{m.name}</td>
                          <td className="px-3 py-2 text-right">{m.stats.mean.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">{m.stats.median.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">{m.stats.stdDev.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Дополнительная информация */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl shadow-lg p-6 border-2 border-blue-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4">📋 Информация о группе</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600 mb-1">ID группы:</p>
            <p className="font-mono text-gray-900 bg-white px-2 py-1 rounded">{group.id}</p>
          </div>
          <div>
            <p className="text-gray-600 mb-1">Дата создания:</p>
            <p className="text-gray-900 font-semibold">
              {new Date(group.createdAt).toLocaleString('ru-RU')}
            </p>
          </div>
          <div>
            <p className="text-gray-600 mb-1">Последнее обновление:</p>
            <p className="text-gray-900 font-semibold">
              {new Date(group.updatedAt).toLocaleString('ru-RU')}
            </p>
          </div>
          <div>
            <p className="text-gray-600 mb-1">Всего условий:</p>
            <p className="text-gray-900 font-semibold">
              {group.filters.length + (group.hierarchyFilters ? Object.keys(group.hierarchyFilters).length : 0)} фильтров
            </p>
          </div>
        </div>
      </div>

      {/* Кнопки навигации */}
      <div className="flex justify-between items-center">
        <Link
          href="/dashboard/overview"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-semibold transition-colors"
        >
          <ArrowLeft size={18} />
          К обзору
        </Link>
        <Link
          href="/groups"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
        >
          Редактировать группу
          <Edit2 size={18} />
        </Link>
      </div>
    </div>
  );
}
