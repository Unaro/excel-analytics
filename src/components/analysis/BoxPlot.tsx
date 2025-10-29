import { useMemo } from 'react';

interface BoxPlotProps {
  data: number[];
  label: string;
  color?: string;
}

export default function BoxPlot({ data, label, color = '#3b82f6' }: BoxPlotProps) {
  const stats = useMemo(() => {
    const sorted = [...data].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const median = sorted[Math.floor(sorted.length / 2)];
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lowerWhisker = Math.max(min, q1 - 1.5 * iqr);
    const upperWhisker = Math.min(max, q3 + 1.5 * iqr);
    
    const outliers = sorted.filter(v => v < lowerWhisker || v > upperWhisker);

    return { min, max, median, q1, q3, lowerWhisker, upperWhisker, outliers };
  }, [data]);

  const range = stats.max - stats.min;
  const scale = 100 / range;

  const getPosition = (value: number) => ((value - stats.min) * scale);

  return (
    <div className="p-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-4">{label}</h4>
      <div className="relative h-20">
        {/* Whiskers */}
        <div 
          className="absolute h-1 bg-gray-400"
          style={{
            left: `${getPosition(stats.lowerWhisker)}%`,
            width: `${getPosition(stats.upperWhisker) - getPosition(stats.lowerWhisker)}%`,
            top: '50%',
          }}
        />
        
        {/* Box */}
        <div 
          className="absolute h-12 rounded border-2"
          style={{
            left: `${getPosition(stats.q1)}%`,
            width: `${getPosition(stats.q3) - getPosition(stats.q1)}%`,
            top: '25%',
            backgroundColor: `${color}20`,
            borderColor: color,
          }}
        >
          {/* Median line */}
          <div 
            className="absolute h-full w-1"
            style={{
              left: `${((stats.median - stats.q1) / (stats.q3 - stats.q1)) * 100}%`,
              backgroundColor: color,
            }}
          />
        </div>

        {/* Outliers */}
        {stats.outliers.map((outlier, idx) => (
          <div
            key={idx}
            className="absolute w-2 h-2 rounded-full"
            style={{
              left: `${getPosition(outlier)}%`,
              top: '45%',
              backgroundColor: '#ef4444',
            }}
            title={`Выброс: ${outlier.toFixed(2)}`}
          />
        ))}
      </div>
      
      {/* Legend */}
      <div className="mt-4 grid grid-cols-5 gap-2 text-xs text-gray-600">
        <div>
          <div className="font-semibold">Min</div>
          <div>{stats.min.toFixed(1)}</div>
        </div>
        <div>
          <div className="font-semibold">Q1</div>
          <div>{stats.q1.toFixed(1)}</div>
        </div>
        <div>
          <div className="font-semibold">Медиана</div>
          <div>{stats.median.toFixed(1)}</div>
        </div>
        <div>
          <div className="font-semibold">Q3</div>
          <div>{stats.q3.toFixed(1)}</div>
        </div>
        <div>
          <div className="font-semibold">Max</div>
          <div>{stats.max.toFixed(1)}</div>
        </div>
      </div>
      {stats.outliers.length > 0 && (
        <div className="mt-2 text-xs text-red-600">
          ⚠️ Обнаружено {stats.outliers.length} выбросов
        </div>
      )}
    </div>
  );
}
