'use client';
import { ClientOnly } from '@/shared/lib/hydration';
import { LoadingScreen } from '@/shared/ui/loading-screen';
import { TemplateManager } from '@/widgets/TemplateManager';

export function MetricsManagerWidget() {
  return (
    <ClientOnly fallback={<LoadingScreen message="Загрузка метрик..." />}>
      <MetricsManagerContent />
    </ClientOnly>
  );
}

function MetricsManagerContent() {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          Метрики и Правила
        </h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-2xl">
          Библиотека формул и правил агрегации. Создайте здесь абстрактные шаблоны
          (например,{' '}
          <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-xs">
            SUM(x)
          </code>{' '}
          или{' '}
          <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-xs">
            A / B
          </code>
          ), которые затем будут использоваться в группах показателей.
        </p>
      </div>

      <TemplateManager />
    </div>
  );
}