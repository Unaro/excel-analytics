'use client';

import { Calculator, HelpCircle } from 'lucide-react';

interface FormulaBuilderProps {
  value: string;
  onChange: (value: string) => void;
  availableFields: string[];
  error?: string;
}

const FUNCTIONS = [
  { name: 'SUM', description: 'Сумма значений', example: 'SUM(поле)' },
  { name: 'AVG', description: 'Среднее значение', example: 'AVG(поле)' },
  { name: 'COUNT', description: 'Количество записей', example: 'COUNT(поле)' },
  { name: 'MIN', description: 'Минимальное значение', example: 'MIN(поле)' },
  { name: 'MAX', description: 'Максимальное значение', example: 'MAX(поле)' },
];

const OPERATORS = [
  { symbol: '+', description: 'Сложение' },
  { symbol: '-', description: 'Вычитание' },
  { symbol: '*', description: 'Умножение' },
  { symbol: '/', description: 'Деление' },
  { symbol: '()', description: 'Скобки для приоритета' },
];

export function FormulaBuilder({ 
  value, 
  onChange, 
  availableFields,
  error 
}: FormulaBuilderProps) {
  const insertText = (text: string) => {
    onChange(value + text);
  };

  return (
    <div className="space-y-4">
      {/* Редактор формулы */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Calculator className="w-4 h-4 inline mr-1" />
          Формула
        </label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Например: SUM(Доход) / COUNT(ID)"
          className={`w-full px-4 py-3 border ${
            error ? 'border-red-300' : 'border-gray-300'
          } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm`}
          rows={3}
        />
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      {/* Доступные поля */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Доступные поля:
        </label>
        <div className="flex flex-wrap gap-2">
          {availableFields.length > 0 ? (
            availableFields.map((field) => (
              <button
                key={field}
                onClick={() => insertText(field)}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {field}
              </button>
            ))
          ) : (
            <p className="text-sm text-gray-500">Поля не найдены</p>
          )}
        </div>
      </div>

      {/* Функции */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Функции:
        </label>
        <div className="grid grid-cols-2 gap-2">
          {FUNCTIONS.map((func) => (
            <button
              key={func.name}
              onClick={() => insertText(`${func.name}()`)}
              className="p-2 text-left bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-sm"
              title={func.description}
            >
              <code className="font-mono text-blue-700">{func.example}</code>
              <p className="text-xs text-gray-600 mt-1">{func.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Операторы */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Операторы:
        </label>
        <div className="flex flex-wrap gap-2">
          {OPERATORS.map((op) => (
            <button
              key={op.symbol}
              onClick={() => insertText(` ${op.symbol} `)}
              className="px-3 py-1 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors font-mono text-sm"
              title={op.description}
            >
              {op.symbol}
            </button>
          ))}
        </div>
      </div>

      {/* Примеры */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <HelpCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-blue-900 mb-2">Примеры формул:</h4>
            <div className="space-y-1 text-sm text-blue-800">
              <code className="block bg-white px-2 py-1 rounded">SUM(Доход) / COUNT(ID)</code>
              <code className="block bg-white px-2 py-1 rounded">AVG(Возраст) * 12</code>
              <code className="block bg-white px-2 py-1 rounded">(MAX(Цена) - MIN(Цена)) / AVG(Цена)</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
