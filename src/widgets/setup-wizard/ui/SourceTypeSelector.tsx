'use client';
import { FileSpreadsheet, Database } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { SourceType } from '@/features/setup-wizard';

interface SourceTypeSelectorProps {
  value: SourceType;
  onChange: (type: SourceType) => void;
}

export function SourceTypeSelector({ value, onChange }: SourceTypeSelectorProps) {
  return (
    <div className="flex justify-center">
      <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
        <button
          onClick={() => onChange('file')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all',
            value === 'file'
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          )}
        >
          <FileSpreadsheet size={16} /> Excel / CSV
        </button>
        <button
          onClick={() => onChange('postgres')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all',
            value === 'postgres'
              ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          )}
        >
          <Database size={16} /> PostgreSQL
        </button>
      </div>
    </div>
  );
}