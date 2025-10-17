'use client';

import { Download } from 'lucide-react';

interface GroupSummaryTableProps {
  groups: Array<{
    groupId: string;
    groupName: string;
    indicators: Array<{
      name: string;
      value: number;
      formula: string;
    }>;
    rowCount: number;
  }>;
  onExport?: () => void;
}

export default function GroupSummaryTable({ groups, onExport }: GroupSummaryTableProps) {
  if (groups.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        Нет данных для отображения. Создайте группы показателей.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-semibold">Сводная таблица показателей</h3>
        {onExport && (
          <button
            onClick={onExport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm"
          >
            <Download size={16} />
            Экспорт
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="px-4 py-3 text-left font-semibold text-sm">Группа</th>
              <th className="px-4 py-3 text-left font-semibold text-sm">Показатель</th>
              <th className="px-4 py-3 text-left font-semibold text-sm">Формула</th>
              <th className="px-4 py-3 text-right font-semibold text-sm">Значение</th>
              <th className="px-4 py-3 text-right font-semibold text-sm">Строк</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group, groupIndex) => (
              group.indicators.map((indicator, indicatorIndex) => (
                <tr
                  key={`${group.groupId}-${indicatorIndex}`}
                  className={groupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                >
                  {indicatorIndex === 0 && (
                    <td
                      rowSpan={group.indicators.length}
                      className="px-4 py-3 font-semibold text-gray-800 border-r border-gray-200"
                    >
                      {group.groupName}
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm text-gray-800">{indicator.name}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 font-mono">{indicator.formula}</td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-600">
                    {indicator.value.toFixed(2)}
                  </td>
                  {indicatorIndex === 0 && (
                    <td
                      rowSpan={group.indicators.length}
                      className="px-4 py-3 text-right text-gray-600 border-l border-gray-200"
                    >
                      {group.rowCount}
                    </td>
                  )}
                </tr>
              ))
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
