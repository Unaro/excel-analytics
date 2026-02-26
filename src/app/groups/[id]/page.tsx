'use client';

import { Suspense, use } from 'react';
import Link from 'next/link';
import { useUrlFilters } from '@/lib/hooks/use-url-filters';
import { useGroupProfile } from '@/lib/hooks/use-group-profile';
import { useStoreHydration } from '@/lib/hooks/use-store-hydration';
import { HierarchyTree } from '@/widgets/HierarchyFilter';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { ArrowLeft, Layers, Loader2, Calculator, Edit, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { LoadingScreen } from '@/shared/ui/loading-screen';

function GroupProfileContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hydrated = useStoreHydration();

  const { filters, setFilters } = useUrlFilters();
  const { group, result, isComputing, virtualMetrics } = useGroupProfile(id, filters);

  if (!hydrated) {
    return <LoadingScreen message="Загрузка системы..." />;
  }

  if (!group) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-white">
        <div className="text-xl font-bold mb-2">Группа не найдена</div>
        <Button variant="ghost" asChild>
          <Link href="/groups">Вернуться к списку</Link>
        </Button>
      </div>
    );
  }

  const chartData = result ? virtualMetrics.map(vm => {
    const val = result.virtualMetrics.find(r => r.virtualMetricId === vm.id);
    return {
      name: vm.name,
      value: val?.value || 0,
      formatted: val?.formattedValue
    };
  }) : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 p-6 space-y-6 transition-colors">

      {/* Хедер */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="rounded-full">
            <Link href="/groups">
              <ArrowLeft size={20} />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
               <Layers size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{group.name}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Детальный профиль показателей</p>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
           <Link href={`/groups/${id}/edit`}>
             <Edit size={16} className="mr-2" /> Настроить группу
           </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ЛЕВАЯ КОЛОНКА: Фильтры */}
        <div className="lg:col-span-3">
          <HierarchyTree
            currentFilters={filters}
            onFilterChange={setFilters}
          />
        </div>

        {/* ПРАВАЯ КОЛОНКА: Контент */}
        <div className="lg:col-span-9 space-y-6">

          {/* Карточки показателей (KPI Cards) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isComputing ? (
               [1,2,3].map(i => <div key={i} className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />)
            ) : result?.virtualMetrics.map(metric => {
               return (
                 <Card key={metric.virtualMetricId} className="p-5 flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors duration-300 group">
                    <div className="flex justify-between items-start">
                       <span className="text-sm font-medium text-slate-500 dark:text-slate-400 h-10 line-clamp-2" title={metric.virtualMetricName}>
                         {metric.virtualMetricName}
                       </span>
                       <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-400 group-hover:text-indigo-500 transition-colors">
                         <Calculator size={14} />
                       </div>
                    </div>
                    <div className="mt-2">
                       <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                          {metric.value === null ? <span className="text-slate-300">—</span> : metric.formattedValue}
                       </div>
                    </div>
                 </Card>
               );
            })}
          </div>

          {/* График */}
          <Card className="p-6 min-h-[400px]">
             <div className="flex items-center gap-2 mb-6">
               <BarChart3 className="text-indigo-500" size={20} />
               <h3 className="font-bold text-slate-900 dark:text-white">Визуализация значений</h3>
             </div>

             <div className="h-[350px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#94a3b8" strokeOpacity={0.2} />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={180}
                      tick={{fontSize: 12, fill: '#94a3b8'}}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{fill: 'transparent'}}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded shadow-xl text-xs">
                              <span className="font-bold text-slate-900 dark:text-white">{payload[0].payload.formatted}</span>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24} animationDuration={1000}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#10b981' : '#34d399'} />
                      ))}
                    </Bar>
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </Card>

        </div>
      </div>
    </div>
  );
}

export default function GroupProfilePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingScreen message="Загрузка профиля группы..." />}>
      <GroupProfileContent params={params} />
    </Suspense>
  );
}
