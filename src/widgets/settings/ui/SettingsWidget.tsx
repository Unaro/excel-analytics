'use client';
import { ClientOnly } from '@/shared/lib/hydration';
import { LoadingScreen } from '@/shared/ui/loading-screen';
import { DatasetConfigSection } from './DatasetConfigSection';
import { OrphanedDatasetsSection } from './OrphanedDatasetsSection';
import { SystemResetSection } from './SystemResetSection';

export function SettingsWidget() {
  return (
    <ClientOnly fallback={<LoadingScreen message="Загрузка настроек..." />}>
      <SettingsContent />
    </ClientOnly>
  );
}

function SettingsContent() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Настройки</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Управление конфигурацией приложения
        </p>
      </div>

      <div className="grid gap-6">
        <DatasetConfigSection />
        <OrphanedDatasetsSection />
        <SystemResetSection />
      </div>
    </div>
  );
}