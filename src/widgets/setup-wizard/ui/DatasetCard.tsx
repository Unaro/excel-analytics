'use client';
import {
  FileSpreadsheet,
  Database,
  Trash2,
  Upload,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/lib/utils';
import type { DatasetEntry } from '@/entities/dataset';

interface DatasetCardProps {
  dataset: DatasetEntry;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onReplace: () => void;
  onImportConfig: () => void;
}

export function DatasetCard({
  dataset,
  isActive,
  onSelect,
  onDelete,
  onReplace,
  onImportConfig,
}: DatasetCardProps) {
  const isFile = dataset.sourceType === 'file';
  const subtitle = isFile
    ? 'Excel/CSV'
    : `PostgreSQL: ${dataset.pgConfig?.schema}.${dataset.pgConfig?.table}`;

  return (
    <div
      className={cn(
        'flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer group',
        isActive
          ? 'border-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/20 dark:border-indigo-800'
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'p-2 rounded-lg',
            isFile
              ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20'
              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20'
          )}
        >
          {isFile ? <FileSpreadsheet size={18} /> : <Database size={18} />}
        </div>
        <div>
          <div className="font-medium text-slate-900 dark:text-white">
            {dataset.name}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {subtitle} • {dataset.rows?.length ?? 0} строк
          </div>
        </div>
        {isActive && (
          <Badge
            variant="outline"
            className="ml-2 text-[10px] border-indigo-200 text-indigo-600 dark:border-indigo-800 dark:text-indigo-400"
          >
            Активен
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isFile && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Заменить файл (обновить данные)"
            onClick={(e) => {
              e.stopPropagation();
              onReplace();
            }}
          >
            <RefreshCw size={14} />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 size={14} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
          title="Импортировать настройки в этот датасет"
          onClick={(e) => {
            e.stopPropagation();
            onImportConfig();
          }}
        >
          <Upload size={14} />
        </Button>

        <ChevronRight size={16} className="text-slate-400" />
      </div>
    </div>
  );
}