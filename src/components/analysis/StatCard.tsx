interface StatCardProps {
  label: string;
  value: string | number;
  description?: string;
  color?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export default function StatCard({ label, value, description, color = '#3b82f6', trend }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg p-4 border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: color }}>
      <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {trend && (
          <span className={`text-xs font-semibold ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
    </div>
  );
}
