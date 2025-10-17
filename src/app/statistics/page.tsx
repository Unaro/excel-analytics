'use client';

import { useEffect, useState } from 'react';
import { getData } from '../actions/excel';
import { applyStatisticsRule } from '@/lib/excel-parser';
import { Plus, Trash2 } from 'lucide-react';

interface Rule {
  id: string;
  column: string;
  condition: string;
  value: string;
  aggregation: string;
}

export default function StatisticsPage() {
  const [sheets, setSheets] = useState<any[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [newRule, setNewRule] = useState<Partial<Rule>>({
    column: '',
    condition: '=',
    value: '',
    aggregation: 'sum',
  });
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

  const addRule = () => {
    if (newRule.column && newRule.value) {
      setRules([
        ...rules,
        {
          id: Date.now().toString(),
          column: newRule.column!,
          condition: newRule.condition!,
          value: newRule.value!,
          aggregation: newRule.aggregation!,
        },
      ]);
      setNewRule({
        column: '',
        condition: '=',
        value: '',
        aggregation: 'sum',
      });
    }
  };

  const deleteRule = (id: string) => {
    setRules(rules.filter((r) => r.id !== id));
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
      <h1 className="text-3xl font-bold mb-6">Статистические расчёты</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Создать правило расчёта</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Колонка</label>
            <select
              value={newRule.column}
              onChange={(e) => setNewRule({ ...newRule, column: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Выберите</option>
              {availableHeaders.map((header: string) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Условие</label>
            <select
              value={newRule.condition}
              onChange={(e) => setNewRule({ ...newRule, condition: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="=">=</option>
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value=">=">&gt;=</option>
              <option value="<=">&lt;=</option>
              <option value="!=">!=</option>
              <option value="contains">содержит</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Значение</label>
            <input
              type="text"
              value={newRule.value}
              onChange={(e) => setNewRule({ ...newRule, value: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Введите значение"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Агрегация</label>
            <select
              value={newRule.aggregation}
              onChange={(e) => setNewRule({ ...newRule, aggregation: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="sum">Сумма</option>
              <option value="count">Количество</option>
              <option value="avg">Среднее</option>
              <option value="min">Минимум</option>
              <option value="max">Максимум</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={addRule}
              disabled={!newRule.column || !newRule.value}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              <Plus size={20} />
              Добавить
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table>
          <thead>
            <tr>
              <th>Колонка</th>
              <th>Условие</th>
              <th>Значение</th>
              <th>Агрегация</th>
              <th>Результат</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => {
              const result = applyStatisticsRule(
                sheets[0].rows,
                rule.column,
                rule.condition,
                rule.value,
                rule.aggregation
              );

              return (
                <tr key={rule.id}>
                  <td className="font-medium">{rule.column}</td>
                  <td>{rule.condition}</td>
                  <td>{rule.value}</td>
                  <td>{rule.aggregation}</td>
                  <td className="font-semibold text-blue-600">
                    {result.toFixed(2)}
                  </td>
                  <td>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {rules.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Нет созданных правил. Создайте первое правило для расчёта статистики.
          </div>
        )}
      </div>
    </div>
  );
}
