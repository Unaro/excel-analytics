import { COLORS } from '@/lib/storage';
import { TrendingUp, Filter, Layers, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface DetailCardProps {
  data: {
    groupId: string;
    groupName: string;
    filters: {
      id: string;
      column: string;
      operator: string;
      value: string;
    }[];
    hierarchyFilters: Record<string, string> | undefined;
    deepestFilter: {
      column: string;
      value: string;
    } | null;
    indicators: {
      name: string;
      formula: string;
      value: number;
    }[];
    rowCount: number;
  };
  index: number;
}

export default function DetailCard({ data, index }: DetailCardProps) {
  const borderColor = COLORS[index % COLORS.length];

  return (
    <Link href={`/dashboard/group/${data.groupId}`}>
      <div
        className={`
          group relative overflow-hidden bg-gradient-to-br from-white to-gray-50 
          rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer
          border-l-4 transform hover:scale-105
        `}
        style={{ borderLeftColor: borderColor }}
      >
        {/* Градиентный фон */}
        <div 
          className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity"
          style={{ backgroundColor: borderColor }}
        />

        <div className="relative p-6">
          {/* Заголовок */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                {data.groupName}
              </h3>
              
              {/* Фильтры */}
              {data.deepestFilter && (
                <div className="items-center gap-2 text-sm bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg border border-purple-200 inline-flex">
                  <Layers size={14} />
                  <span className="font-medium">
                    {data.deepestFilter.column}: {data.deepestFilter.value}
                  </span>
                </div>
              )}
            </div>

            {/* Бейдж индекса */}
            <div 
              className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md"
              style={{ backgroundColor: borderColor }}
            >
              #{index + 1}
            </div>
          </div>

          {/* Показатели */}
          <div className="space-y-3 mb-4">
            {data.indicators.map((indicator) => (
              <div 
                key={indicator.name}
                className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center gap-2 flex-1">
                  <TrendingUp size={16} className="text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">
                    {indicator.name}
                  </span>
                </div>
                <span className="text-lg font-bold" style={{ color: borderColor }}>
                  {indicator.value.toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {/* Футер */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Filter size={14} />
              <span>На основе {data.rowCount} записей</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-blue-600 font-medium group-hover:gap-2 transition-all">
              <span>Подробнее</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
