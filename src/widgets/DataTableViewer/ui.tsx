// widgets/DataTableViewer/ui.tsx
'use client';
import { useState, useMemo } from 'react';
import { ArrowLeft, ArrowRight, ChevronsLeft, ChevronsRight, Loader2, Database } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import type { DatasetRow } from '@/types';
import { formatDataValue } from '@/shared/lib/utils/format';

interface DataTableViewerProps {
  data: DatasetRow[];
  columns?: string[];
  title?: string;
  loading?: boolean;
  error?: string | null;
  pageSize?: number;
  enablePagination?: boolean;
  actions?: React.ReactNode;
  emptyMessage?: string;
  className?: string;
}

export function DataTableViewer({
  data,
  columns,
  title,
  loading = false,
  error = null,
  pageSize = 50,
  enablePagination = true,
  actions,
  emptyMessage = 'Нет данных для отображения',
  className
}: DataTableViewerProps) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const paginatedData = useMemo(() => {
    if (!enablePagination || data.length <= pageSize) return data;
    const start = (safePage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, safePage, pageSize, enablePagination]);

  const resolvedColumns = useMemo(() => {
    if (columns?.length) return columns;
    return data.length ? Object.keys(data[0]) : [];
  }, [columns, data]);

  // --- UI ---
  if (loading) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-16 text-slate-400 gap-3 border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-800", className)}>
        <Loader2 className="animate-spin text-indigo-500" size={32} />
        <span className="text-sm">Загрузка данных...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-red-500 gap-2 border rounded-xl bg-red-50/30 dark:bg-red-900/10 dark:border-red-900/30", className)}>
        <Database size={24} className="opacity-50" />
        <span className="text-sm font-medium">{error}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-800 overflow-hidden shadow-sm", className)}>
      {/* Хедер */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
          {title || `Таблица данных (${data.length.toLocaleString()} строк)`}
        </span>
        <div className="flex items-center gap-2">{actions}</div>
      </div>

      {/* Тело таблицы */}
      <div className="overflow-auto custom-scrollbar max-h-[550px]">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <Database size={32} className="opacity-30" />
            <span className="text-sm">{emptyMessage}</span>
          </div>
        ) : (
          <table className="min-w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
              <tr>
                {enablePagination && <th className="p-3 border-b dark:border-slate-800 font-bold text-slate-400 w-12 text-center bg-inherit">#</th>}
                {resolvedColumns.map(col => (
                  <th key={col} className="p-3 border-b dark:border-slate-800 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap max-w-[250px] truncate bg-inherit">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {paginatedData.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  {enablePagination && (
                    <td className="p-3 text-slate-400 font-mono text-center border-r border-slate-50 dark:border-slate-800/50">
                      {(safePage - 1) * pageSize + idx + 1}
                    </td>
                  )}

                  {resolvedColumns.map(col => {
                    const cellValue = formatDataValue(row[col]);

                    return (
                      <td key={col} className={cn(
                        "p-3 max-w-[250px] truncate text-right transition-colors",
                        typeof cellValue.type === 'number' 
                          ? "text-slate-900 dark:text-slate-100 font-mono font-medium" 
                          : "text-slate-600 dark:text-slate-400",
                        typeof cellValue.type === 'boolean' && "text-center",
                        cellValue.display === "—" && "text-slate-300 dark:text-slate-600 italic"
                      )}>
                          {cellValue.display}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Футер пагинации */}
      {enablePagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Страница <span className="font-medium text-slate-900 dark:text-slate-200">{safePage}</span> из {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage === 1} onClick={() => setPage(1)}>
              <ChevronsLeft size={14} />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage === 1} onClick={() => setPage(p => p - 1)}>
              <ArrowLeft size={14} />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage === totalPages} onClick={() => setPage(p => p + 1)}>
              <ArrowRight size={14} />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage === totalPages} onClick={() => setPage(totalPages)}>
              <ChevronsRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}