// src/components/common/FilterStats.tsx
'use client';

interface FilterStatsProps {
  totalRows: number;
  filteredRows: number;
  percentage: number;
  className?: string;
}

export default function FilterStats({ totalRows, filteredRows, percentage, className = '' }: FilterStatsProps) {
  if (totalRows === filteredRows) return null;
  return (
    <div className={`flex items-center gap-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm ${className}`}>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
        <span className="font-medium text-blue-800">
          Отфильтровано: {filteredRows.toLocaleString()} из {totalRows.toLocaleString()} строк
        </span>
      </div>
      <div className="text-blue-600 font-bold">{percentage}%</div>
    </div>
  );
}
