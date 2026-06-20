'use client';

import { Loader2, ArrowLeft, Database, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/lib/utils';
import type { FilePreview } from '@/features/setup-dataset';

interface ImportConfigStepProps {
  fileName: string;
  preview: FilePreview | null;
  previewLoading: boolean;
  isImporting: boolean;
  onImport: () => void;
  onCancel: () => void;
}

const DELIM_LABEL: Record<string, string> = {
  ',': 'запятая ( , )',
  ';': 'точка с запятой ( ; )',
  '\t': 'табуляция ( \\t )',
  '|': 'вертикальная черта ( | )',
};

/**
 * Шаг «Импорт»: предпросмотр первых строк файла перед тяжёлой загрузкой.
 *
 * Фаза 2 — только предпросмотр и запуск импорта. Параметры разбора
 * (разделитель/десятичный/типы колонок) добавляются в Фазе 3.
 */
export function ImportConfigStep({
  fileName,
  preview,
  previewLoading,
  isImporting,
  onImport,
  onCancel,
}: ImportConfigStepProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg shrink-0">
            <FileSpreadsheet size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
              {fileName}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Предпросмотр первых строк. Проверьте данные перед импортом.
            </p>
          </div>
        </div>
        {preview && (
          <div className="flex flex-wrap gap-2 justify-end shrink-0">
            <Badge variant="outline">{preview.headers.length} колонок</Badge>
            {preview.isCsv && preview.delimiter && (
              <Badge variant="outline">
                Разделитель: {DELIM_LABEL[preview.delimiter] ?? preview.delimiter}
              </Badge>
            )}
          </div>
        )}
      </div>

      {previewLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
          <Loader2 className="animate-spin text-indigo-500" size={32} />
          <span className="text-sm">Чтение предпросмотра...</span>
        </div>
      ) : !preview || preview.headers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <AlertTriangle size={28} className="opacity-40" />
          <span className="text-sm">Не удалось прочитать предпросмотр файла.</span>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm dark:border-slate-800">
          <div className="max-h-[420px] overflow-auto custom-scrollbar">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase w-10">
                    #
                  </th>
                  {preview.headers.map((h, i) => (
                    <th
                      key={`${h}-${i}`}
                      className="px-4 py-2 text-left text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap"
                    >
                      {h || <span className="text-slate-400 italic">колонка {i + 1}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {preview.rows.map((row, ri) => (
                  <tr
                    key={ri}
                    className={cn(
                      ri % 2 === 1 && 'bg-slate-50/50 dark:bg-slate-800/20'
                    )}
                  >
                    <td className="px-3 py-1.5 text-[11px] text-slate-400 font-mono">
                      {ri + 1}
                    </td>
                    {preview.headers.map((_, ci) => (
                      <td
                        key={ci}
                        className="px-4 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-[260px] truncate"
                        title={row[ci] ?? ''}
                      >
                        {row[ci] ?? (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.truncated && (
            <div className="px-4 py-2 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
              Показаны первые {preview.rows.length} строк. Полные данные загрузятся при импорте.
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between items-center pt-4 border-t dark:border-slate-800">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isImporting} className="gap-2">
          <ArrowLeft size={14} /> Выбрать другой файл
        </Button>
        <Button
          onClick={onImport}
          disabled={isImporting || previewLoading || !preview}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
        >
          {isImporting ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Импорт...
            </>
          ) : (
            <>
              <Database size={16} /> Импортировать
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
