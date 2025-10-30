'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { IndicatorWithValue } from '@/lib/data-store';

interface SummaryTableRow {
  groupId: string;
  groupName: string;
  indicators: IndicatorWithValue[];
  rowCount: number;
}

interface SummaryTableProps {
  data: SummaryTableRow[];
  emptyText?: string;
  stickyColumn?: boolean;
  showRowCount?: boolean;
  showTotals?: boolean;
  highlightMax?: boolean;
  highlightMin?: boolean;
}

export default function SummaryTable({
  data,
  emptyText = 'Нет данных для отображения',
  stickyColumn = true,
  showRowCount = true,
  showTotals = true,
  highlightMax = false,
  highlightMin = false,
}: SummaryTableProps) {
  
  // Получаем все уникальные названия показателей
  const allIndicatorNames = useMemo(() => {
    const namesSet = new Set<string>();
    data.forEach(row => {
      row.indicators.forEach(ind => namesSet.add(ind.name));
    });
    return Array.from(namesSet).sort();
  }, [data]);

  // Вычисляем итоги
  const totals = useMemo(() => {
    const sums: Record<string, number> = {};
    let totalRowCount = 0;

    data.forEach(row => {
      totalRowCount += row.rowCount;
      row.indicators.forEach(ind => {
        sums[ind.name] = (sums[ind.name] || 0) + ind.value;
      });
    });

    return { sums, totalRowCount };
  }, [data]);

  // Находим максимальные и минимальные значения для каждого показателя
  const extremes = useMemo(() => {
    const max: Record<string, number> = {};
    const min: Record<string, number> = {};

    allIndicatorNames.forEach(name => {
      const values = data
        .map(row => row.indicators.find(i => i.name === name)?.value)
        .filter((v): v is number => v !== undefined);
      
      if (values.length > 0) {
        max[name] = Math.max(...values);
        min[name] = Math.min(...values);
      }
    });

    return { max, min };
  }, [data, allIndicatorNames]);

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {emptyText}
      </div>
    );
  }

  const getCellClassName = (indicatorName: string, value: number) => {
    let className = 'px-4 py-3 text-right';
    
    if (highlightMax && value === extremes.max[indicatorName]) {
      className += ' bg-green-50 font-semibold text-green-700';
    } else if (highlightMin && value === extremes.min[indicatorName]) {
      className += ' bg-red-50 font-semibold text-red-700';
    }
    
    return className;
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th
              className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                stickyColumn ? 'sticky left-0 bg-gray-50 z-10' : ''
              }`}
            >
              Группа
            </th>
            {allIndicatorNames.map((name) => (
              <th
                key={name}
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {name}
              </th>
            ))}
            {showRowCount && (
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Строк
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row) => (
            <tr key={row.groupId} className="hover:bg-gray-50 group">
              <td
                className={`px-4 py-3 text-sm font-medium text-gray-900 ${
                  stickyColumn ? 'sticky left-0 bg-white group-hover:bg-gray-50 z-10' : ''
                }`}
              >
                <Link
                  href={`/dashboard/group/${row.groupId}`}
                  className="flex items-center hover:text-blue-600 transition-colors"
                >
                  {row.groupName}
                  <ExternalLink className="w-3 h-3 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </td>
              {allIndicatorNames.map((name) => {
                const indicator = row.indicators.find((i) => i.name === name);
                return (
                  <td
                    key={name}
                    className={
                      indicator
                        ? getCellClassName(name, indicator.value)
                        : 'px-4 py-3 text-right text-gray-400'
                    }
                  >
                    {indicator ? indicator.value.toFixed(2) : '—'}
                  </td>
                );
              })}
              {showRowCount && (
                <td className="px-4 py-3 text-right text-sm text-gray-600">
                  {row.rowCount.toLocaleString()}
                </td>
              )}
            </tr>
          ))}
          
          {/* Строка с итогами */}
          {showTotals && (
            <tr className="bg-gray-100 font-semibold">
              <td
                className={`px-4 py-3 text-sm text-gray-900 ${
                  stickyColumn ? 'sticky left-0 bg-gray-100 z-10' : ''
                }`}
              >
                ИТОГО
              </td>
              {allIndicatorNames.map((name) => (
                <td key={name} className="px-4 py-3 text-right text-sm text-gray-900">
                  {(totals.sums[name] || 0).toFixed(2)}
                </td>
              ))}
              {showRowCount && (
                <td className="px-4 py-3 text-right text-sm text-gray-900">
                  {totals.totalRowCount.toLocaleString()}
                </td>
              )}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
