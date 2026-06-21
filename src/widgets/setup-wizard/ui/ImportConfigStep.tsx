'use client';

import { Loader2, ArrowLeft, Database, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Select, SelectOption } from '@/shared/ui/select';
import { cn } from '@/shared/lib/utils';
import type { FilePreview, ImportParams, DecimalSeparator, AggregateMatrix } from '@/features/setup-dataset';
import type { ColumnClassification } from '@/shared/lib/types';
import { AggregateStructurePanel } from './AggregateStructurePanel';

interface ImportConfigStepProps {
  fileName: string;
  preview: FilePreview | null;
  previewLoading: boolean;
  isImporting: boolean;
  importParams: ImportParams | null;
  onDelimiterChange: (delimiter: string) => void;
  onDecimalChange: (dec: DecimalSeparator) => void;
  onColumnTypeChange: (columnName: string, type: ColumnClassification) => void;
  onImport: () => void;
  onCancel: () => void;
  /** Режим файла-агрегата (иерархия по уровням) — фаза 0: предпросмотр структуры. */
  isAggregate: boolean;
  onAggregateToggle: (on: boolean) => void;
  aggregateMatrix: AggregateMatrix | null;
}

const NEWLINE_LABEL: Record<string, string> = {
  '\r\n': 'CRLF (Windows)',
  '\n': 'LF (Unix)',
  '\r': 'CR (Mac)',
};

const DELIMITER_OPTIONS: { value: string; label: string }[] = [
  { value: ',', label: 'Запятая  ,' },
  { value: ';', label: 'Точка с запятой  ;' },
  { value: '\t', label: 'Табуляция  \\t' },
  { value: '|', label: 'Вертикальная черта  |' },
];

const TYPE_OPTIONS: { value: ColumnClassification; label: string }[] = [
  { value: 'numeric', label: '123 Число' },
  { value: 'categorical', label: 'Абв Текст' },
  { value: 'date', label: 'Дата' },
  { value: 'ignore', label: '— Пропустить' },
];

const TYPE_BADGE: Record<ColumnClassification, string> = {
  numeric: 'text-indigo-600 dark:text-indigo-300',
  categorical: 'text-slate-600 dark:text-slate-300',
  date: 'text-emerald-600 dark:text-emerald-300',
  ignore: 'text-slate-400',
};

/**
 * Шаг «Импорт»: предпросмотр первых строк + параметры разбора (разделитель,
 * десятичный разделитель, тип каждой колонки) до тяжёлой загрузки.
 *
 * Фаза 3a — контролы с живым перепарсингом preview. Проброс параметров
 * в сам импорт (нативный read_csv_auto для CSV) — Фаза 3b.
 */
export function ImportConfigStep({
  fileName,
  preview,
  previewLoading,
  isImporting,
  importParams,
  onDelimiterChange,
  onDecimalChange,
  onColumnTypeChange,
  onImport,
  onCancel,
  isAggregate,
  onAggregateToggle,
  aggregateMatrix,
}: ImportConfigStepProps) {
  const showCsvControls = !!preview?.isCsv && !!importParams;

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
              Проверьте данные и типы колонок перед импортом.
            </p>
          </div>
        </div>
        {preview && (
          <div className="flex flex-wrap gap-2 justify-end shrink-0">
            <Badge variant="outline">{preview.headers.length} колонок</Badge>
            {preview.isCsv && preview.newline && (
              <Badge variant="outline">
                Строки: {NEWLINE_LABEL[preview.newline] ?? preview.newline}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* ─── Тумблер «файл-агрегат» (иерархия по уровням) ─── */}
      <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer">
        <input
          type="checkbox"
          checked={isAggregate}
          onChange={(e) => onAggregateToggle(e.target.checked)}
          className="mt-0.5"
        />
        <div>
          <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
            Это файл-агрегат (иерархия по уровням)
          </div>
          <div className="text-[11px] text-slate-400">
            Шапка с группами, строки-уровни (город → зона → объект), предпосчитанные
            итоги. Покажем предпросмотр структуры.
          </div>
        </div>
      </label>

      {isAggregate && <AggregateStructurePanel matrix={aggregateMatrix} />}

      {/* ─── Параметры разбора (CSV) ─── */}
      {showCsvControls && importParams && (
        <div className="flex flex-wrap gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Разделитель колонок
            </label>
            <Select
              className="h-9 w-52"
              value={importParams.delimiter ?? ','}
              onChange={(e) => onDelimiterChange(e.target.value)}
            >
              {DELIMITER_OPTIONS.map((o) => (
                <SelectOption key={o.value} value={o.value}>{o.label}</SelectOption>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Десятичный разделитель
            </label>
            <Select
              className="h-9 w-44"
              value={importParams.decimalSeparator}
              onChange={(e) => onDecimalChange(e.target.value as DecimalSeparator)}
            >
              <SelectOption value=".">Точка  12.34</SelectOption>
              <SelectOption value=",">Запятая  12,34</SelectOption>
            </Select>
          </div>
        </div>
      )}

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
                  {preview.headers.map((h, i) => {
                    const type = importParams?.columnTypes[h] ?? 'categorical';
                    return (
                      <th
                        key={`${h}-${i}`}
                        className="px-4 py-2 text-left align-top min-w-[140px]"
                      >
                        <div className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap mb-1">
                          {h || <span className="text-slate-400 italic">колонка {i + 1}</span>}
                        </div>
                        {importParams && (
                          <Select
                            className={cn('h-7 text-xs font-medium px-2 py-0', TYPE_BADGE[type])}
                            value={type}
                            onChange={(e) =>
                              onColumnTypeChange(h, e.target.value as ColumnClassification)
                            }
                          >
                            {TYPE_OPTIONS.map((o) => (
                              <SelectOption key={o.value} value={o.value}>{o.label}</SelectOption>
                            ))}
                          </Select>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {preview.rows.map((row, ri) => (
                  <tr
                    key={ri}
                    className={cn(ri % 2 === 1 && 'bg-slate-50/50 dark:bg-slate-800/20')}
                  >
                    <td className="px-3 py-1.5 text-[11px] text-slate-400 font-mono">
                      {ri + 1}
                    </td>
                    {preview.headers.map((h, ci) => (
                      <td
                        key={ci}
                        className={cn(
                          'px-4 py-1.5 whitespace-nowrap max-w-[260px] truncate',
                          importParams?.columnTypes[h] === 'ignore'
                            ? 'text-slate-300 dark:text-slate-600 line-through'
                            : 'text-slate-700 dark:text-slate-300'
                        )}
                        title={row[ci] ?? ''}
                      >
                        {row[ci] || (
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
