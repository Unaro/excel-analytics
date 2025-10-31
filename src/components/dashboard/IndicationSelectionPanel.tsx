'use client';

import { AlertCircle, CheckCircle } from 'lucide-react';
import { IndicatorSelector } from './IndicatorSelector';

interface IndicatorSelectionPanelProps {
  indicators: string[];
  selectedIndicators: string[];
  onSelect: (indicators: string[]) => void;
  title: string;
  subtitle?: string;
  mode?: 'single' | 'multiple';
  emptyMessage?: string;
}

export function IndicatorSelectionPanel({
  indicators,
  selectedIndicators,
  onSelect,
  title,
  subtitle,
  mode = 'multiple',
  emptyMessage = 'Нет показателей',
}: IndicatorSelectionPanelProps): React.ReactNode {
  const hasIndicators = indicators.length > 0;
  const isSelected = selectedIndicators.length > 0;

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
        {isSelected && (
          <CheckCircle className="w-5 h-5 text-green-600" />
        )}
      </div>

      {hasIndicators ? (
        <IndicatorSelector
          indicators={indicators}
          selectedIndicators={selectedIndicators}
          onChange={onSelect}
        />
      ) : (
        <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg text-gray-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p className="text-sm">{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}
