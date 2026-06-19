'use client';

import { DatasetConfigSection } from './DatasetConfigSection';
import { FormulaSettingsSection } from './FormulaSettingsSection';
import { OrphanedDatasetsSection } from './OrphanedDatasetsSection';
import { SystemResetSection } from './SystemResetSection';

/**
 * Приватный оркестратор страницы настроек.
 *
 * Отвечает за:
 *  1. Рендер заголовка страницы
 *  2. Композицию трёх секций настроек (Dataset / Orphaned / System Reset)
 *
 * НЕ должен экспортироваться наружу — используется только SettingsWidget.
 */
export function SettingsContent() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Настройки</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Управление конфигурацией приложения
        </p>
      </div>
      <div className="grid gap-6">
        <FormulaSettingsSection />
        <DatasetConfigSection />
        <OrphanedDatasetsSection />
        <SystemResetSection />
      </div>
    </div>
  );
}