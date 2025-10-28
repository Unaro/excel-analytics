'use client';

import { useState, useEffect } from 'react';
import { ExcelRow } from '@/types';

interface HierarchyFilterProps {
  data: ExcelRow[];
  config: string[]; // ['Область','Город','Район','Улица']
  onFilterChange: (filters: Record<string, string>) => void;
}

export function HierarchyFilter({ data, config, onFilterChange }: HierarchyFilterProps) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<Record<string, string[]>>({});

  // Инициализация опций для первого уровня
  useEffect(() => {
    if (config.length > 0) {
      const col = config[0];
      const uniq = Array.from(new Set(data.map(r => String(r[col] || ''))))
        .filter(v => v && v !== 'null' && v !== 'undefined');
      setOptions({ [col]: uniq.sort() });
    }
  }, [data, config]);

  // Пересчет опций при изменении selections
  useEffect(() => {
    if (config.length === 0) return;

    // Получаем текущий выбранный уровень
    const selectedLevels = Object.keys(selections).filter(k => selections[k]);
    
    if (selectedLevels.length === 0) {
      // Если ничего не выбрано, показываем только первый уровень
      return;
    }

    // Пересчитываем опции для всех последующих уровней
    const newOptions: Record<string, string[]> = { ...options };
    
    for (let i = 0; i < config.length; i++) {
      const currentCol = config[i];
      
      if (i === 0) {
        // Первый уровень всегда имеет все опции
        continue;
      }

      // Получаем родительскую колонку
      const parentCol = config[i - 1];
      const parentValue = selections[parentCol];

      if (!parentValue) {
        // Если родитель не выбран, очищаем опции для текущего и всех следующих
        for (let j = i; j < config.length; j++) {
          delete newOptions[config[j]];
        }
        break;
      }

      // Фильтруем данные по всем предыдущим выборам
      let filteredData = data;
      for (let j = 0; j < i; j++) {
        const col = config[j];
        const val = selections[col];
        if (val) {
          filteredData = filteredData.filter(r => String(r[col] || '') === val);
        }
      }

      // Получаем уникальные значения для текущего уровня
      const uniq = Array.from(new Set(filteredData.map(r => String(r[currentCol] || ''))))
        .filter(v => v && v !== 'null' && v !== 'undefined');
      
      newOptions[currentCol] = uniq.sort();
    }

    setOptions(newOptions);
  }, [selections, data, config]);

  // Отправляем изменения наружу
  useEffect(() => {
    onFilterChange(selections);
  }, [selections, onFilterChange]);

  const handleChange = (col: string, value: string, index: number) => {
    const newSelections = { ...selections };
    
    if (value) {
      newSelections[col] = value;
    } else {
      delete newSelections[col];
    }

    // Сбрасываем все последующие уровни
    for (let i = index + 1; i < config.length; i++) {
      delete newSelections[config[i]];
    }

    setSelections(newSelections);
  };

  if (config.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-purple-50 to-green-50 rounded-lg p-6 mb-4 border-1 border-purple-200">
      <h3 className="text-lg font-semibold text-purple-900 mb-2 flex items-center gap-2">
        Иерархический фильтр
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {config.map((col, idx) => {
          const isDisabled = idx > 0 && !selections[config[idx - 1]];
          const availableOptions = options[col] || [];
          const currentValue = selections[col] || '';

          return (
            <div key={col} className="flex flex-col">
              <label className="text-sm font-medium mb-2 text-gray-700 flex items-center gap-1">
                <span className="bg-purple-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                  {idx + 1}
                </span>
                {col}
              </label>
              <select
                disabled={isDisabled || availableOptions.length === 0}
                value={currentValue}
                onChange={(e) => handleChange(col, e.target.value, idx)}
                className={`
                  w-full px-3 py-2 border rounded-lg transition-all
                  ${isDisabled 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' 
                    : 'bg-white border-purple-300 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 hover:border-purple-400'
                  }
                  ${currentValue ? 'font-semibold text-purple-900' : 'text-gray-600'}
                `}
              >
                <option value="">
                  {isDisabled 
                    ? `Выберите ${config[idx - 1]}...` 
                    : availableOptions.length === 0 
                      ? 'Нет доступных опций'
                      : 'Все'
                  }
                </option>
                {availableOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              
              {/* Показываем количество доступных опций */}
              {!isDisabled && availableOptions.length > 0 && (
                <span className="text-xs text-gray-500 mt-1">
                  {availableOptions.length} {availableOptions.length === 1 ? 'вариант' : 'вариантов'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Показываем путь выбора */}
      {Object.keys(selections).filter(k => selections[k]).length > 0 && (
        <div className="mt-2 pt-2 border-t border-purple-200">
          <p className="text-sm text-gray-600 mb-2">Выбранный путь:</p>
          <div className="flex items-center gap-2 flex-wrap">
            {config.map((col, idx) => {
              const value = selections[col];
              if (!value) return null;
              
              return (
                <div key={col} className="flex items-center gap-2">
                  <div className="bg-purple-100 text-purple-900 px-3 py-1 rounded-full text-sm font-medium">
                    {col}: <strong>{value}</strong>
                  </div>
                  {idx < config.length - 1 && selections[config[idx + 1]] && (
                    <span className="text-purple-400">→</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
