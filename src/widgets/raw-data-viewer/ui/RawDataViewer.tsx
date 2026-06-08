'use client';

import { useMemo } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { DataTableViewer } from '@/widgets/data-table-viewer';
import { Info, Loader2, AlertCircle } from 'lucide-react';

export function RawDataViewer() {
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  const activeDataset = useDatasetStore(s => activeDatasetId ? s.datasets[activeDatasetId] : null);
  const rows = useDatasetStore(s => s.getAllData());

  const columns = useMemo(() => {
    return rows.length > 0 ? Object.keys(rows[0]) : [];
  }, [rows]);

  if (!activeDatasetId || !activeDataset) return null;

  const isFileSource = activeDataset.sourceType === 'file';
  const totalRows = activeDataset.metadata?.totalRows ?? 0;
  const isShowingPreview = isFileSource && rows.length < totalRows;
  const engineStatus = activeDataset.engineStatus;

  if (isFileSource && engineStatus === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500 border rounded-xl bg-white dark:bg-slate-900">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
        <span className="text-sm font-medium">Восстановление данных из кэша...</span>
      </div>
    );
  }

  if (isFileSource && engineStatus === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-red-500 border rounded-xl bg-red-50/30 dark:bg-red-900/10">
        <AlertCircle size={32} className="opacity-50" />
        <span className="text-sm font-medium">Не удалось загрузить данные в DuckDB</span>
        <span className="text-xs text-slate-400">Попробуйте перезагрузить страницу или загрузить файл заново</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isShowingPreview && rows.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Info size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-700 dark:text-blue-300">
            <span className="font-semibold">Показаны первые {rows.length.toLocaleString('ru-RU')} строк из {totalRows.toLocaleString('ru-RU')}.</span>
            <span className="block mt-0.5 opacity-80">
              Все данные загружены в DuckDB и используются для вычислений дашбордов. Это только предпросмотр.
            </span>
          </div>
        </div>
      )}

      <DataTableViewer
        data={rows}
        columns={columns}
        title={isShowingPreview ? `Предпросмотр (${rows.length} из ${totalRows})` : 'Проверка данных'}
        enablePagination={true}
        pageSize={50}
        className="min-h-[400px]"
      />
    </div>
  );
}