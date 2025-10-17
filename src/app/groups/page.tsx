'use client';

import { useEffect, useState } from 'react';
import { getData } from '../actions/excel';
import { calculateGroupMetrics } from '@/lib/excel-parser';
import { Plus, Trash2 } from 'lucide-react';

interface Group {
  id: string;
  name: string;
  indicators: string[];
}

export default function GroupsPage() {
  const [sheets, setSheets] = useState<any[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

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

  const addGroup = () => {
    if (newGroupName && selectedIndicators.length > 0) {
      setGroups([
        ...groups,
        {
          id: Date.now().toString(),
          name: newGroupName,
          indicators: selectedIndicators,
        },
      ]);
      setNewGroupName('');
      setSelectedIndicators([]);
    }
  };

  const deleteGroup = (id: string) => {
    setGroups(groups.filter((g) => g.id !== id));
  };

  const toggleIndicator = (indicator: string) => {
    if (selectedIndicators.includes(indicator)) {
      setSelectedIndicators(selectedIndicators.filter((i) => i !== indicator));
    } else {
      setSelectedIndicators([...selectedIndicators, indicator]);
    }
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
    <div>
      <h1 className="text-3xl font-bold mb-6">Группы показателей</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Создать новую группу</h2>
        
        <input
          type="text"
          placeholder="Название группы"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
        />

        <div className="mb-4">
          <p className="font-medium mb-2">Выберите показатели:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {availableHeaders.map((header: string) => (
              <label key={header} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIndicators.includes(header)}
                  onChange={() => toggleIndicator(header)}
                  className="w-4 h-4"
                />
                <span className="text-sm">{header}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={addGroup}
          disabled={!newGroupName || selectedIndicators.length === 0}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          <Plus size={20} />
          Добавить группу
        </button>
      </div>

      <div className="space-y-4">
        {groups.map((group) => {
          const metrics = calculateGroupMetrics(sheets[0].rows, group.indicators);
          
          return (
            <div key={group.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold">{group.name}</h3>
                <button
                  onClick={() => deleteGroup(group.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 size={20} />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Показатели: {group.indicators.join(', ')}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th>Показатель</th>
                      <th>Сумма</th>
                      <th>Среднее</th>
                      <th>Минимум</th>
                      <th>Максимум</th>
                      <th>Количество</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.indicators.map((indicator) => (
                      <tr key={indicator}>
                        <td className="font-medium">{indicator}</td>
                        <td>{metrics[`${indicator}_sum`]?.toFixed(2) || '-'}</td>
                        <td>{metrics[`${indicator}_avg`]?.toFixed(2) || '-'}</td>
                        <td>{metrics[`${indicator}_min`]?.toFixed(2) || '-'}</td>
                        <td>{metrics[`${indicator}_max`]?.toFixed(2) || '-'}</td>
                        <td>{metrics[`${indicator}_count`] || 0}</td>
                      </tr>
                    ))}
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
