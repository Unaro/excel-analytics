'use client';
import { Card } from '@/shared/ui/card';
import { Database } from 'lucide-react';

/**
 * Placeholder для будущего функционала:
 * управление "сиротскими" датасетами (привязка удалённых источников).
 */
export function OrphanedDatasetsSection() {
  return (
    <Card className="p-6 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
      <div className="flex items-center gap-3 opacity-50">
        <Database size={18} className="text-slate-400" />
        <div>
          <h3 className="font-medium text-slate-700 dark:text-slate-300">
            Привязка удалённых источников
          </h3>
          <p className="text-xs text-slate-400">
            Функционал будет доступен в следующем обновлении
          </p>
        </div>
      </div>
    </Card>
  );
}