import { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, Download } from 'lucide-react';

interface IndicatorValue {
  name: string;
  value: number;
}

interface SummaryTableRow {
  groupId: string;
  groupName: string;
  indicators: IndicatorValue[];
  rowCount: number;
  metadata?: Record<string, any>; // Дополнительные данные
}

interface SummaryTableProps {
  data: SummaryTableRow[];
  allIndicatorNames: string[];
  stickyColumn?: boolean;
  showRowCount?: boolean;
  showTotals?: boolean;
  highlightMax?: boolean;
  highlightMin?: boolean;
  sortable?: boolean;
  exportable?: boolean;
  emptyText?: string;
}

type SortConfig = {
  column: string;
  direction: 'asc' | 'desc';
} | null;

export default function SummaryTable({
  data,
  allIndicatorNames,
  stickyColumn = true,
  showRowCount = true,
  showTotals = false,
  highlightMax = false,
  highlightMin = false,
  sortable = true,
  exportable = false,
  emptyText = 'Нет данных для отображения',
}: SummaryTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  // Находим максимальное и минимальное значение для каждого показателя
  const extremeValues = useMemo(() => {
    const extremes: Record<string, { max: number; min: number }> = {};

    allIndicatorNames.forEach(name => {
      const values = data.map(row => {
        const indicator = row.indicators.find(i => i.name === name);
        return indicator ? indicator.value : 0;
      }).filter(v => v !== 0);

      if (values.length > 0) {
        extremes[name] = {
          max: Math.max(...values),
          min: Math.min(...values),
        };
      }
    });

    return extremes;
  }, [data, allIndicatorNames]);

  // Вычисляем итоги
  const totals = useMemo(() => {
    if (!showTotals) return null;

    const sums: Record<string, number> = {};
    let totalRowCount = 0;

    data.forEach(row => {
      totalRowCount += row.rowCount;
      allIndicatorNames.forEach(name => {
        const indicator = row.indicators.find(i => i.name === name);
        if (indicator) {
          sums[name] = (sums[name] || 0) + indicator.value;
        }
      });
    });

    return { sums, totalRowCount };
  }, [data, allIndicatorNames, showTotals]);

  // Сортировка
  const sortedData = useMemo(() => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      if (sortConfig.column === 'groupName') {
        aValue = a.groupName;
        bValue = b.groupName;
      } else if (sortConfig.column === 'rowCount') {
        aValue = a.rowCount;
        bValue = b.rowCount;
      } else {
        const aInd = a.indicators.find(i => i.name === sortConfig.column);
        const bInd = b.indicators.find(i => i.name === sortConfig.column);
        aValue = aInd ? aInd.value : 0;
        bValue = bInd ? bInd.value : 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);

  // Обработчик сортировки
  const handleSort = (column: string) => {
    if (!sortable) return;

    setSortConfig(current => {
      if (!current || current.column !== column) {
        return { column, direction: 'desc' };
      }
      if (current.direction === 'desc') {
        return { column, direction: 'asc' };
      }
      return null;
    });
  };

  // Экспорт в CSV
  const handleExport = () => {
    const headers = ['Группа', ...allIndicatorNames, ...(showRowCount ? ['Записей'] : [])];
    const rows = sortedData.map(row => [
      row.groupName,
      ...allIndicatorNames.map(name => {
        const ind = row.indicators.find(i => i.name === name);
        return ind ? ind.value.toFixed(2) : '—';
      }),
      ...(showRowCount ? [row.rowCount.toString()] : []),
    ]);

    if (showTotals && totals) {
      rows.push([
        'ИТОГО',
        ...allIndicatorNames.map(name => (totals.sums[name] || 0).toFixed(2)),
        ...(showRowCount ? [totals.totalRowCount.toString()] : []),
      ]);
    }

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `summary_table_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Компонент заголовка столбца с сортировкой
  const SortableHeader = ({ column, children }: { column: string; children: React.ReactNode }) => {
    const isSorted = sortConfig?.column === column;
    const direction = sortConfig?.direction;

    return (
      <th
        onClick={() => handleSort(column)}
        className={`px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider ${
          sortable ? 'cursor-pointer hover:bg-blue-100 transition-colors' : ''
        }`}
      >
        <div className="flex items-center gap-2">
          {children}
          {sortable && (
            <div className="flex flex-col">
              <ArrowUp 
                size={12} 
                className={`${isSorted && direction === 'asc' ? 'text-blue-600' : 'text-gray-300'}`}
              />
              <ArrowDown 
                size={12} 
                className={`-mt-1 ${isSorted && direction === 'desc' ? 'text-blue-600' : 'text-gray-300'}`}
              />
            </div>
          )}
        </div>
      </th>
    );
  };

  // Определение цвета ячейки
  const getCellStyle = (value: number, indicatorName: string) => {
    const extreme = extremeValues[indicatorName];
    if (!extreme) return {};

    if (highlightMax && value === extreme.max) {
      return { backgroundColor: '#dcfce7', fontWeight: 'bold', color: '#166534' };
    }
    if (highlightMin && value === extreme.min) {
      return { backgroundColor: '#fee2e2', fontWeight: 'bold', color: '#991b1b' };
    }

    return {};
  };

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        <p className="text-gray-500">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Заголовок с кнопкой экспорта */}
      {exportable && (
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Сводная таблица</h3>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm transition-colors"
          >
            <Download size={16} />
            Экспорт
          </button>
        </div>
      )}

      {/* Таблица */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gradient-to-r from-blue-50 to-purple-50">
            <tr>
              <SortableHeader column="groupName">
                <span className={stickyColumn ? 'sticky left-0 bg-blue-50' : ''}>
                  Группа
                </span>
              </SortableHeader>
              {allIndicatorNames.map(name => (
                <SortableHeader key={name} column={name}>
                  <span className="text-right block">{name}</span>
                </SortableHeader>
              ))}
              {showRowCount && (
                <SortableHeader column="rowCount">
                  <span className="text-right block">Записей</span>
                </SortableHeader>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.map((row) => (
              <tr key={row.groupId} className="hover:bg-gray-50 transition-colors">
                <td 
                  className={`px-6 py-4 whitespace-nowrap font-medium text-gray-900 ${
                    stickyColumn ? 'sticky left-0 bg-white' : ''
                  }`}
                >
                  {row.groupName}
                </td>
                {allIndicatorNames.map(name => {
                  const indicator = row.indicators.find(i => i.name === name);
                  return (
                    <td 
                      key={name} 
                      className="px-6 py-4 whitespace-nowrap text-right"
                      style={indicator ? getCellStyle(indicator.value, name) : {}}
                    >
                      {indicator ? (
                        <span className="font-semibold">
                          {indicator.value.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  );
                })}
                {showRowCount && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600">
                    {row.rowCount.toLocaleString()}
                  </td>
                )}
              </tr>
            ))}
            
            {/* Итоговая строка */}
            {showTotals && totals && (
              <tr className="bg-gradient-to-r from-blue-100 to-purple-100 font-bold">
                <td className={`px-6 py-4 text-gray-900 ${stickyColumn ? 'sticky left-0 bg-blue-100' : ''}`}>
                  ИТОГО
                </td>
                {allIndicatorNames.map(name => (
                  <td key={name} className="px-6 py-4 text-right text-gray-900">
                    {(totals.sums[name] || 0).toFixed(2)}
                  </td>
                ))}
                {showRowCount && (
                  <td className="px-6 py-4 text-right text-gray-900">
                    {totals.totalRowCount.toLocaleString()}
                  </td>
                )}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Легенда */}
      {(highlightMax || highlightMin) && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex gap-4 text-xs">
          {highlightMax && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
              <span className="text-gray-600">Максимальное значение</span>
            </div>
          )}
          {highlightMin && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
              <span className="text-gray-600">Минимальное значение</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
