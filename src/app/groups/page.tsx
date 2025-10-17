'use client';

import { useEffect, useState } from 'react';
import { getData } from '../actions/excel';
import { applyFilters, evaluateFormula } from '@/lib/excel-parser';
import { Plus, Trash2, Filter } from 'lucide-react';

interface FilterCondition {
  id: string;
  column: string;
  operator: string;
  value: string;
}

interface Indicator {
  id: string;
  name: string;
  formula: string;
}

interface Group {
  id: string;
  name: string;
  filters: FilterCondition[];
  indicators: Indicator[];
}

export default function GroupsPage() {
  const [sheets, setSheets] = useState<any[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // Новая группа
  const [newGroupName, setNewGroupName] = useState('');
  const [newFilters, setNewFilters] = useState<FilterCondition[]>([]);
  const [newIndicators, setNewIndicators] = useState<Indicator[]>([]);

  // Текущий фильтр
  const [currentFilter, setCurrentFilter] = useState({
    column: '',
    operator: '=',
    value: '',
  });

  // Текущий индикатор
  const [currentIndicator, setCurrentIndicator] = useState({
    name: '',
    formula: '',
  });

  useEffect(() => {
    async function fetchData() {
      const data = await getData();
      if (data) {
        setSheets(data);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const availableHeaders = sheets[0]?.headers || [];

  const addFilter = () => {
    if (currentFilter.column && currentFilter.value) {
      setNewFilters([
        ...newFilters,
        {
          id: Date.now().toString(),
          ...currentFilter,
        },
      ]);
      setCurrentFilter({ column: '', operator: '=', value: '' });
    }
  };

  const removeFilter = (id: string) => {
    setNewFilters(newFilters.filter(f => f.id !== id));
  };

  const addIndicator = () => {
    if (currentIndicator.name && currentIndicator.formula) {
      setNewIndicators([
        ...newIndicators,
        {
          id: Date.now().toString(),
          ...currentIndicator,
        },
      ]);
      setCurrentIndicator({ name: '', formula: '' });
    }
  };

  const removeIndicator = (id: string) => {
    setNewIndicators(newIndicators.filter(i => i.id !== id));
  };

  const createGroup = () => {
    if (newGroupName && newIndicators.length > 0) {
      setGroups([
        ...groups,
        {
          id: Date.now().toString(),
          name: newGroupName,
          filters: [...newFilters],
          indicators: [...newIndicators],
        },
      ]);
      setNewGroupName('');
      setNewFilters([]);
      setNewIndicators([]);
    }
  };

  const deleteGroup = (id: string) => {
    setGroups(groups.filter(g => g.id !== id));
  };

  if (loading) {
    return <div>Загрузка...</div>;
  }

  if (!sheets || sheets.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-xl text-gray-600">
          Нет загруженных данных. Загрузите Excel файл на главной странице.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">Группы показателей с фильтрацией</h1>

      {/* Форма создания новой группы */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Создать новую группу</h2>

        {/* Название группы */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Название группы</label>
          <input
            type="text"
            placeholder="Например: Балаково жилищные показатели"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        {/* Фильтры */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
            <Filter size={20} />
            Условия фильтрации
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <select
              value={currentFilter.column}
              onChange={(e) => setCurrentFilter({ ...currentFilter, column: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Выберите колонку</option>
              {availableHeaders.map((header: string) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>

            <select
              value={currentFilter.operator}
              onChange={(e) => setCurrentFilter({ ...currentFilter, operator: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="=">=</option>
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value=">=">&gt;=</option>
              <option value="<=">&lt;=</option>
              <option value="!=">!=</option>
              <option value="contains">содержит</option>
            </select>

            <input
              type="text"
              placeholder="Значение"
              value={currentFilter.value}
              onChange={(e) => setCurrentFilter({ ...currentFilter, value: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />

            <button
              onClick={addFilter}
              disabled={!currentFilter.column || !currentFilter.value}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
            >
              <Plus size={20} className="inline mr-1" />
              Добавить фильтр
            </button>
          </div>

          {newFilters.length > 0 && (
            <div className="space-y-2">
              {newFilters.map((filter) => (
                <div
                  key={filter.id}
                  className="flex items-center justify-between bg-blue-50 px-4 py-2 rounded-lg"
                >
                  <span className="text-sm">
                    <strong>{filter.column}</strong> {filter.operator} <em>{filter.value}</em>
                  </span>
                  <button
                    onClick={() => removeFilter(filter.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Показатели с формулами */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Показатели (с формулами)</h3>

          <div className="mb-3">
            <input
              type="text"
              placeholder="Название показателя (например: Средняя обеспеченность)"
              value={currentIndicator.name}
              onChange={(e) => setCurrentIndicator({ ...currentIndicator, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2"
            />

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Формула (например: AVG(Жилищ_обеспеченность_кв_м_чел))"
                value={currentIndicator.formula}
                onChange={(e) => setCurrentIndicator({ ...currentIndicator, formula: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              />
              <button
                onClick={addIndicator}
                disabled={!currentIndicator.name || !currentIndicator.formula}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
              >
                <Plus size={20} className="inline mr-1" />
                Добавить
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-1">
              Доступные функции: SUM(), AVG(), COUNT(), MIN(), MAX(). Используйте названия колонок в формулах.
            </p>
          </div>

          {newIndicators.length > 0 && (
            <div className="space-y-2">
              {newIndicators.map((indicator) => (
                <div
                  key={indicator.id}
                  className="flex items-center justify-between bg-purple-50 px-4 py-2 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">{indicator.name}</p>
                    <p className="text-xs text-gray-600 font-mono">{indicator.formula}</p>
                  </div>
                  <button
                    onClick={() => removeIndicator(indicator.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={createGroup}
          disabled={!newGroupName || newIndicators.length === 0}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
        >
          Создать группу
        </button>
      </div>

      {/* Отображение созданных групп */}
      <div className="space-y-6">
        {groups.map((group) => {
          const filteredData = applyFilters(sheets[0].rows, group.filters);

          return (
            <div key={group.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold">{group.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Строк после фильтрации: {filteredData.length} из {sheets[0].rows.length}
                  </p>
                </div>
                <button
                  onClick={() => deleteGroup(group.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 size={20} />
                </button>
              </div>

              {/* Условия фильтрации */}
              {group.filters.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium mb-2">Условия фильтрации:</p>
                  <div className="flex flex-wrap gap-2">
                    {group.filters.map((filter) => (
                      <span
                        key={filter.id}
                        className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs"
                      >
                        {filter.column} {filter.operator} {filter.value}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Таблица результатов */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-800 text-white">
                      <th className="px-4 py-2 text-left font-semibold">Показатель</th>
                      <th className="px-4 py-2 text-left font-semibold">Формула</th>
                      <th className="px-4 py-2 text-right font-semibold">Результат</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.indicators.map((indicator, idx) => {
                      const result = evaluateFormula(
                        indicator.formula,
                        filteredData,
                        availableHeaders
                      );

                      return (
                        <tr key={indicator.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-100'}>
                          <td className="border border-gray-300 px-4 py-2 font-medium">
                            {indicator.name}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 font-mono text-sm text-gray-600">
                            {indicator.formula}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-right font-semibold text-blue-600">
                            {result.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {groups.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Нет созданных групп. Создайте первую группу показателей.
          </div>
        )}
      </div>
    </div>
  );
}
