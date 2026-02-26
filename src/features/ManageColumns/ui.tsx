'use client';

import { useColumnConfigStore } from '@/entities/excelData';
import { useExcelDataStore } from '@/entities/excelData';
import { ColumnClassification } from '@/types';
import { cn } from '@/shared/lib/utils';

export function ColumnManager() {
  const configs = useColumnConfigStore((s) => s.configs);
  const updateColumn = useColumnConfigStore((s) => s.updateColumn);
  const hasData = useExcelDataStore((s) => s.hasData());

  if (!hasData || configs.length === 0) return null;

  const handleTypeChange = (columnName: string, type: ColumnClassification) => {
    updateColumn(columnName, { classification: type });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Настройка типов данных</h2>
        <div className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
          Колонок: {configs.length}
        </div>
      </div>
      
      <div className="border rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm dark:border-slate-800">
        <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
            <thead className="bg-gray-50 dark:bg-slate-800/80 sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Колонка Excel
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Алиас (код)
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Назначение
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-100 dark:divide-slate-800/50">
              {configs.map((col) => (
                <tr key={col.columnName} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {col.displayName}
                  </td>
                  <td className="px-6 py-3">
                    <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/30">
                      {col.alias}
                    </code>
                  </td>
                  <td className="px-6 py-3 text-sm">
                    <div className="flex space-x-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
                      <TypeButton 
                        isActive={col.classification === 'numeric'} 
                        label="123 Число" 
                        activeColor="bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                        onClick={() => handleTypeChange(col.columnName, 'numeric')}
                      />
                      <TypeButton 
                        isActive={col.classification === 'categorical'} 
                        label="Категория" 
                        activeColor="bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-sm"
                        onClick={() => handleTypeChange(col.columnName, 'categorical')}
                      />
                      <TypeButton 
                        isActive={col.classification === 'ignore'} 
                        label="Скрыто" 
                        activeColor="bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 shadow-sm"
                        onClick={() => handleTypeChange(col.columnName, 'ignore')}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TypeButton({ 
  isActive, 
  label, 
  activeColor,
  onClick 
}: { 
  isActive: boolean, 
  label: string, 
  activeColor: string,
  onClick: () => void 
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-md text-xs font-medium transition-all duration-300",
        isActive ? activeColor : "text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-gray-200/50 dark:hover:bg-slate-700/50"
      )}
    >
      {label}
    </button>
  );
}