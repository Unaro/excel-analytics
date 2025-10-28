'use client';

import { useEffect, useState, useMemo } from 'react';
import { getExcelData } from '@/lib/storage';
import { applyFilters, evaluateFormula } from '@/lib/excel-parser';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieLabel, PieLabelRenderProps } from '@/lib/recharts';
import { AlertCircle, BarChart3 } from 'lucide-react';
import { SheetData } from '@/types';
import Link from 'next/link';

interface Group {
  id: string;
  name: string;
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
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function ComparisonPage() {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [hierarchyConfig, setHierarchyConfig] = useState<string[]>([]);
  
  const [selectedIndicator, setSelectedIndicator] = useState<string>('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  useEffect(() => {
    const data = getExcelData();
    if (data) {
      setSheets(data);
    }

    const savedGroups = localStorage.getItem('analyticsGroups');
    if (savedGroups) {
      const parsedGroups = JSON.parse(savedGroups);
      setGroups(parsedGroups);
      
      // Автоматически выбираем все группы и первый показатель
      if (parsedGroups.length > 0) {
        setSelectedGroupIds(parsedGroups.map((g: Group) => g.id));
        
        // Находим первый общий показатель
        const firstIndicator = parsedGroups[0]?.indicators[0]?.name;
        if (firstIndicator) {
          setSelectedIndicator(firstIndicator);
        }
      }
    }

    const savedConfig = localStorage.getItem('hierarchyConfig');
    if (savedConfig) {
      setHierarchyConfig(JSON.parse(savedConfig));
    }

    setLoading(false);
  }, []);

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

  const groupResults = useMemo(() => {
    if (!sheets || sheets.length === 0 || groups.length === 0) return [];

    return groups
      .filter(g => selectedGroupIds.includes(g.id))
      .map((group) => {
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

        const filteredData = applyFilters(sheets[0].rows, allFilters);
        
        const indicators = group.indicators.map((indicator) => ({
          name: indicator.name,
          formula: indicator.formula,
          value: evaluateFormula(indicator.formula, filteredData, sheets[0].headers),
        }));

        return {
          groupId: group.id,
          groupName: group.name,
          indicators,
          rowCount: filteredData.length,
        };
      });
  }, [sheets, groups, selectedGroupIds, hierarchyConfig]);

  // Получаем все уникальные показатели
  const allIndicators = useMemo(() => {
    const indicators = new Set<string>();
    groups.forEach(g => g.indicators.forEach(i => indicators.add(i.name)));
    return Array.from(indicators);
  }, [groups]);

  // Данные для графиков
  const comparisonData = useMemo(() => {
    if (!selectedIndicator) return [];
    
    return groupResults.map(result => {
      const indicator = result.indicators.find(i => i.name === selectedIndicator);
      return {
        name: result.groupName,
        value: indicator ? indicator.value : 0,
      };
    });
  }, [groupResults, selectedIndicator]);

  // Получаем только общие показатели для выбранных групп
    const commonIndicators = useMemo(() => {
        if (selectedGroupIds.length === 0) return [];
        
        // Получаем выбранные группы
        const selectedGroups = groups.filter(g => selectedGroupIds.includes(g.id));
        
        if (selectedGroups.length === 0) return [];
        if (selectedGroups.length === 1) {
            // Если выбрана одна группа, показываем все её показатели
            return selectedGroups[0].indicators.map(i => i.name);
        }
        
        // Находим показатели, которые есть у ВСЕХ выбранных групп
        const firstGroupIndicators = new Set(selectedGroups[0].indicators.map(i => i.name));
        
        const common = Array.from(firstGroupIndicators).filter(indicatorName => 
            selectedGroups.every(group => 
            group.indicators.some(ind => ind.name === indicatorName)
            )
        );
        
        return common;
        }, [groups, selectedGroupIds]);

        // Автоматически выбираем первый общий показатель при изменении групп
        useEffect(() => {
        if (commonIndicators.length > 0 && !commonIndicators.includes(selectedIndicator)) {
            setSelectedIndicator(commonIndicators[0]);
        } else if (commonIndicators.length === 0) {
            setSelectedIndicator('');
        }
    }, [commonIndicators, selectedIndicator]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!sheets || sheets.length === 0 || groups.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle size={48} className="mx-auto text-yellow-500 mb-4" />
        <p className="text-xl text-gray-600 mb-4">
          {!sheets || sheets.length === 0 
            ? 'Нет загруженных данных' 
            : 'Нет созданных групп показателей'
          }
        </p>
        <Link
          href={!sheets || sheets.length === 0 ? '/' : '/groups'}
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {!sheets || sheets.length === 0 ? 'Загрузить данные' : 'Создать группу'}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Заголовок */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Режим сравнения групп</h1>
        <p className="text-gray-600">
          Сравните одинаковый показатель между разными группами
        </p>
      </div>

      {/* Панель настроек */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Выбор показателя */}
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
                📊 Показатель для сравнения:
            </label>
            <select
                value={selectedIndicator}
                onChange={(e) => setSelectedIndicator(e.target.value)}
                className="w-full px-4 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                disabled={commonIndicators.length === 0}
            >
                <option value="">
                {commonIndicators.length === 0 
                    ? '-- Нет общих показателей --' 
                    : '-- Выберите показатель --'
                }
                </option>
                {commonIndicators.map(ind => (
                <option key={ind} value={ind}>{ind}</option>
                ))}
            </select>
            
            {selectedGroupIds.length > 1 && commonIndicators.length === 0 && (
                <p className="mt-2 text-sm text-orange-600">
                ⚠️ У выбранных групп нет общих показателей
                </p>
            )}
            
            {commonIndicators.length > 0 && (
                <p className="mt-2 text-sm text-green-600">
                ✓ Доступно {commonIndicators.length} общих {commonIndicators.length === 1 ? 'показатель' : 'показателей'}
                </p>
            )}
            </div>
          
          {/* Выбор групп */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🎯 Группы для сравнения:
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border-2 border-green-300 rounded-lg">
              {groups.map(group => (
                <label 
                  key={group.id} 
                  className="flex items-center gap-2 p-2 hover:bg-green-50 rounded cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedGroupIds.includes(group.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedGroupIds([...selectedGroupIds, group.id]);
                      } else {
                        setSelectedGroupIds(selectedGroupIds.filter(id => id !== group.id));
                      }
                    }}
                    className="w-4 h-4 text-green-600"
                  />
                  <span className="text-sm">{group.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Информация о выборе */}
        <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <div className="flex items-start justify-between">
                <div>
                <p className="text-sm text-green-800">
                    <strong>Выбрано:</strong> {selectedGroupIds.length} {selectedGroupIds.length === 1 ? 'группа' : 'групп'}
                    {selectedIndicator && ` · Показатель: ${selectedIndicator}`}
                </p>
                {selectedGroupIds.length > 1 && (
                    <p className="text-xs text-green-700 mt-1">
                    Общих показателей: {commonIndicators.length}
                    </p>
                )}
                </div>
                
                {selectedGroupIds.length > 0 && commonIndicators.length === 0 && (
                <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded text-xs font-medium">
                    Нет общих показателей
                </div>
                )}
            </div>
        </div>
      </div>

      {/* Визуализация */}
      {selectedIndicator && comparisonData.length > 0 ? (
        <div className="space-y-6">
          {/* Карточки с числами */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {comparisonData.map((item, index) => (
              <div 
                key={index}
                className="bg-white rounded-lg shadow-lg p-4 border-l-4 hover:shadow-xl transition-shadow"
                style={{ borderColor: COLORS[index % COLORS.length] }}
              >
                <p className="text-sm text-gray-600 mb-1">{item.name}</p>
                <p className="text-3xl font-bold" style={{ color: COLORS[index % COLORS.length] }}>
                  {item.value.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">{selectedIndicator}</p>
              </div>
            ))}
          </div>

          {/* Графики */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Столбчатая диаграмма */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <BarChart3 size={24} className="text-green-600" />
                Сравнение по группам
              </h2>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={comparisonData.map(data => ({name: data.name, value: data.value.toFixed(1)}))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" name={selectedIndicator}>
                    {comparisonData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Круговая диаграмма */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Распределение</h2>
                <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                    <Pie
                        data={comparisonData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry: PieLabelRenderProps) => typeof entry.value === 'number' ? `${entry.name} : ${entry.value.toFixed(0)}` : String(entry.value)}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                    >
                        {comparisonData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip 
                        formatter={(value: number) => value.toFixed(1)}
                    />
                    <Legend />
                    </PieChart>
                </ResponsiveContainer>
                </div>
          </div>

          {/* Таблица сравнения */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Таблица сравнения</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Группа
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {selectedIndicator}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      % от общего
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {comparisonData.map((item, index) => {
                    const total = comparisonData.reduce((sum, d) => sum + d.value, 0);
                    const percentage = (item.value / total) * 100;
                    
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="text-sm font-medium text-gray-900">{item.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-semibold">
                          {item.value.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {percentage.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-lg p-12 text-center">
          <BarChart3 size={64} className="mx-auto text-gray-300 mb-4" />
          <p className="text-xl text-gray-600 mb-2">Выберите показатель для сравнения</p>
          <p className="text-sm text-gray-500">
            Выберите показатель и группы выше, чтобы увидеть визуализацию
          </p>
        </div>
      )}
    </div>
  );
}
