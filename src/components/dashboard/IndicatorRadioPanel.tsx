// src/components/dashboard/IndicatorRadioPanel.tsx (рефакторинг)
'use client';

import { CheckCircle } from 'lucide-react';
import { SelectorHeader, OptionRadio, EmptyHint } from '@/components/common/selector';

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
}: IndicatorRadioPanelProps) {
  const hasIndicators = indicators.length > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <SelectorHeader
        title={title}
        subtitle={hasIndicators ? subtitle : emptyMessage}
        right={selectedIndicator ? <CheckCircle className="w-5 h-5 text-green-600" /> : undefined}
      />

      {hasIndicators ? (
        <div className="space-y-2">
          {indicators.map((indicator) => (
            <OptionRadio
              key={indicator}
              label={indicator}
              name="indicator"
              checked={selectedIndicator === indicator}
              onChange={() => onSelect(indicator)}
            />
          ))}
        </div>
      ) : (
        <EmptyHint text={emptyMessage} />
      )}
    </div>
  );
}
