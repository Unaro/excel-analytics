'use client';
import { useState, useEffect } from 'react';
import { getPgSchema, fetchPgTableData } from '@/app/actions/postgres';
import { DatasetRow, syncFromPostgres } from '@/entities/dataset';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Table, Loader2, Check, Database, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { PgConnectionConfig } from '@/lib/logic/postgres-client';

interface PostgresTableBrowserProps {
  config: PgConnectionConfig;
  onComplete: () => void;
}

export function PostgresTableBrowser({ config, onComplete }: PostgresTableBrowserProps) {
  const [tables, setTables] = useState<{ schema: string; table: string; columns: { name: string; type: string }[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<{ schema: string; table: string } | null>(null);
  const [previewRows, setPreviewRows] = useState<DatasetRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setLoading(true);
    getPgSchema(config).then(res => {
      if (res.success) {
        setTables(res.tables);
      } else {
        setError(res.error || 'Ошибка загрузки схемы');
      }
      setLoading(false);
    }).catch(() => {
      setError('Не удалось получить схему');
      setLoading(false);
    });
  }, [config]);

  const handleSelectTable = async (schema: string, table: string) => {
    setSelectedTable({ schema, table });
    setPreviewLoading(true);
    setPreviewRows([]);
    try {
      const res = await fetchPgTableData(config, schema, table, 50);
      if (res.success) setPreviewRows(res.rows);
      else toast.error(res.error || 'Ошибка предпросмотра');
    } catch {
      toast.error('Ошибка загрузки предпросмотра');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSync = async () => {
    if (!selectedTable) return;
    setSyncing(true);
    try {
      const res = await syncFromPostgres(config, selectedTable.schema, selectedTable.table);
      if (res.success) {
        toast.success('Датасет успешно синхронизирован');
        onComplete();
      } else {
        toast.error(res.error || 'Ошибка синхронизации');
      }
    } catch {
      toast.error('Неизвестная ошибка при синхронизации');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;
  if (error) return <div className="flex items-center gap-2 text-red-500 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg"><AlertCircle size={16} /> {error}</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="p-4 lg:col-span-1 max-h-[500px] overflow-y-auto custom-scrollbar space-y-2">
        <h3 className="font-semibold text-sm text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Database size={16} /> Таблицы
        </h3>
        {tables.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Нет доступных таблиц</p>}
        {tables.map(t => (
          <button
            key={`${t.schema}.${t.table}`}
            onClick={() => handleSelectTable(t.schema, t.table)}
            className={`w-full text-left p-3 rounded-lg border transition-all text-sm flex items-center gap-2 ${
              selectedTable?.table === t.table && selectedTable?.schema === t.schema
                ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Table size={14} className="shrink-0 opacity-70" />
            <div className="truncate">
              <div className="font-medium truncate">{t.table}</div>
              <div className="text-[10px] text-slate-400 font-mono">{t.schema}</div>
            </div>
          </button>
        ))}
      </Card>

      <Card className="p-4 lg:col-span-2 flex flex-col min-h-[500px]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
            Предпросмотр {selectedTable ? `(${selectedTable.schema}.${selectedTable.table})` : ''}
          </h3>
          {selectedTable && (
            <Button onClick={handleSync} disabled={syncing} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {syncing ? 'Синхронизация...' : 'Синхронизировать датасет'}
            </Button>
          )}
        </div>

        {!selectedTable && <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Выберите таблицу слева для предпросмотра</div>}
        {selectedTable && previewLoading && <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" size={24} /></div>}
        {selectedTable && !previewLoading && previewRows.length > 0 && (
          <div className="flex-1 overflow-auto custom-scrollbar border rounded-lg dark:border-slate-800">
            <table className="min-w-full text-xs divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
                <tr>{Object.keys(previewRows[0]).map(col => <th key={col} className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">{col}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-950">
                {previewRows.slice(0, 20).map((row, i) => (
                    <tr key={i}>
                        {Object.values(row).map((val, j) => (
                        <td key={j} className="px-3 py-1.5 text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                            {val != null ? String(val) : <span className="text-slate-300">null</span>}
                        </td>
                        ))}
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {selectedTable && !previewLoading && previewRows.length === 0 && <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Таблица пуста</div>}
      </Card>
    </div>
  );
}