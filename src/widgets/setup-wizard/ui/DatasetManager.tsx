'use client';
import { Plus } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { DatasetCard } from './DatasetCard';
import type { DatasetEntry } from '@/entities/dataset';
import type { PgConnectionConfig } from '@/shared/api/postgres/client';

interface DatasetManagerProps {
  datasets: Record<string, DatasetEntry>;
  activeId: string | null;
  onAddNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onReplace: (id: string, name: string) => void;
  onImportConfig: (id: string) => void;
}

export function DatasetManager({
  datasets,
  activeId,
  onAddNew,
  onSelect,
  onDelete,
  onReplace,
  onImportConfig,
}: DatasetManagerProps) {
  // Справочники (role: 'reference') управляются на странице «Справочники»
  const datasetList = Object.values(datasets).filter(ds => ds.role !== 'reference');

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Загруженные источники
        </h2>
        <Button onClick={onAddNew} className="gap-2">
          <Plus size={16} /> Добавить источник
        </Button>
      </div>

      <div className="grid gap-3">
        {datasetList.length === 0 && (
          <div className="text-center py-8 text-slate-400 border-2 border-dashed rounded-xl">
            Нет загруженных датасетов
          </div>
        )}

        {datasetList.map(ds => (
          <DatasetCard
            key={ds.id}
            dataset={ds}
            isActive={ds.id === activeId}
            onSelect={() => onSelect(ds.id)}
            onDelete={() => onDelete(ds.id)}
            onReplace={() => onReplace(ds.id, ds.name)}
            onImportConfig={() => onImportConfig(ds.id)}
          />
        ))}
      </div>
    </div>
  );
}