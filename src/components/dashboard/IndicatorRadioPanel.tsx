'use client';

import { AlertCircle, CheckCircle } from 'lucide-react';

interface IndicatorRadioPanelProps {
  indicators: string[];
  selectedIndicator: string;
  onSelect: (indicator: string) => void;
  title: string;
  subtitle?: string;
  emptyMessage?: string;
}

export function IndicatorRadioPanel({
  indicators,
  selectedIndicator,
  onSelect,
  title,
  subtitle,
  emptyMessage = 'Нет показателей',
}: IndicatorRadioPanelProps): React.ReactNode {
  const hasIndicators = indicators.length > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {subtitle && (
            <p className="text-sm text-gray-600 mt-1">
              {hasIndicators ? subtitle : emptyMessage}
            </p>
          )}
        </div>
        {selectedIndicator && <CheckCircle className="w-5 h-5 text-green-600" />}
      </div>

      {hasIndicators ? (
        <div className="space-y-2">
          {indicators.map((indicator) => (
            <label
              key={indicator}
              className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedIndicator === indicator
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="indicator"
                value={indicator}
                checked={selectedIndicator === indicator}
                onChange={() => onSelect(indicator)}
                className="w-4 h-4"
              />
              <span className="font-medium text-gray-900">{indicator}</span>
            </label>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg text-gray-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p className="text-sm">{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}
