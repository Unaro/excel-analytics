interface IndicatorSelectorProps {
  indicators: string[];
  selectedIndicators: string[];
  onChange: (indicators: string[]) => void;
  multiple?: boolean;
  emptyMessage?: string;
}

export function IndicatorSelector({ 
  indicators, 
  selectedIndicators, 
  onChange, 
  multiple = true,
  emptyMessage = 'Нет доступных показателей'
}: IndicatorSelectorProps) {
  if (indicators.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  const handleToggle = (indicator: string) => {
    if (multiple) {
      const newIndicators = selectedIndicators.includes(indicator)
        ? selectedIndicators.filter(i => i !== indicator)
        : [...selectedIndicators, indicator];
      onChange(newIndicators);
    } else {
      onChange([indicator]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {indicators.map(indicator => (
        <button
          key={indicator}
          onClick={() => handleToggle(indicator)}
          className={`px-4 py-2 rounded transition-colors ${
            selectedIndicators.includes(indicator)
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {indicator}
        </button>
      ))}
    </div>
  );
}
