'use client';

import { TrendingUp } from 'lucide-react';
import type { IndicatorWithValue } from '@/lib/data-store';

interface IndicatorsListProps {
  indicators: IndicatorWithValue[];
  className?: string;
}

/**
 * Список показателей с формулами и значениями
 */
export function IndicatorsList({ indicators, className = '' }: IndicatorsListProps) {
  if (indicators.length === 0) {
    return (
      <p className="text-sm text-gray-500">Нет показателей</p>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      {indicators.map((indicator, index) => (
        <div 
          key={indicator.name + index} 
          className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center">
              <TrendingUp className="w-5 h-5 text-blue-500 mr-2" />
              <h4 className="font-semibold text-gray-800">{indicator.name}</h4>
            </div>
          </div>
          
          <div className="mb-3">
            <div className="text-3xl font-bold text-blue-600">
              {indicator.value.toLocaleString('ru-RU', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Формула:</div>
            <code className="block text-sm bg-gray-50 px-2 py-1 rounded text-gray-700 break-all">
              {indicator.formula}
            </code>
          </div>
        </div>
      ))}
    </div>
  );
}
