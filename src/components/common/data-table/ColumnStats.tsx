// src/components/common/data-table/ColumnStats.tsx
'use client';

import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { DataRow, ColumnStatsMap } from '@/types/data-table';
import { KeyValueRow } from '@/components/common';

interface ColumnStatsProps {
  data: DataRow[];
  selectedColumns: Set<string>;
  onColumnToggle: (column: string) => void;
}

export function ColumnStats({ data, selectedColumns, onColumnToggle }: ColumnStatsProps) {
  const stats = useMemo((): ColumnStatsMap => {
    const result: ColumnStatsMap = {};
    
    selectedColumns.forEach(column => {
      const numericValues = data
        .map(row => row[column])
        .filter((val): val is number => typeof val === 'number' && !isNaN(val));

      if (numericValues.length > 0) {
        result[column] = {
          sum: numericValues.reduce((a, b) => a + b, 0),
          avg: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          count: numericValues.length,
        };
      }
    });

    return result;
  }, [data, selectedColumns]);

  if (selectedColumns.size === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <BarChart3 size={20} />
        Статистика по выбранным колонкам
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(stats).map(([column, columnStats]) => (
          <div 
            key={column} 
            className="bg-white rounded-lg p-4 border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onColumnToggle(column)}
          >
            <h4 className="font-semibold text-gray-900 mb-2">{column}</h4>
            <div className="space-y-1 text-sm">
              <KeyValueRow label="Сумма" value={columnStats.sum.toFixed(2)} />
              <KeyValueRow label="Среднее" value={columnStats.avg.toFixed(2)} />
              <KeyValueRow label="Мин" value={columnStats.min.toFixed(2)} />
              <KeyValueRow label="Макс" value={columnStats.max.toFixed(2)} />
              <div className="border-t pt-1">
                <KeyValueRow label="Записей" value={columnStats.count.toString()} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
