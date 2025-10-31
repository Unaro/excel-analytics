// src/components/dashboard/IndicatorSelector.tsx (рефакторинг)
import { SelectorHeader, OptionChip, EmptyHint } from '@/components/common/selector';

interface IndicatorSelectorProps {
  indicators: string[];
  selectedIndicators: string[];
  onChange: (indicators: string[]) => void;
  multiple?: boolean;
  emptyMessage?: string;
  title?: string;
  subtitle?: string;
}

export function IndicatorSelector({
  indicators,
  selectedIndicators,
  onChange,
  multiple = true,
  emptyMessage = 'Нет доступных показателей',
  title = 'Выбор показателей',
  subtitle,
}: IndicatorSelectorProps) {
  if (indicators.length === 0) {
    return <EmptyHint text={emptyMessage} />;
  }

  const handleToggle = (indicator: string) => {
    if (multiple) {
      const next = selectedIndicators.includes(indicator)
        ? selectedIndicators.filter((i) => i !== indicator)
        : [...selectedIndicators, indicator];
      onChange(next);
    } else {
      onChange([indicator]);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <SelectorHeader title={title} subtitle={subtitle} />
      <div className="flex flex-wrap gap-2">
        {indicators.map((indicator) => (
          <OptionChip
            key={indicator}
            label={indicator}
            selected={selectedIndicators.includes(indicator)}
            onClick={() => handleToggle(indicator)}
          />
        ))}
      </div>
    </div>
  );
}
