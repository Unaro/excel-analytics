'use client';
import { useState, useEffect } from 'react';
import { getPgSchema, fetchPgTableData } from '@/app/actions/postgres';
import { DatasetRow, syncFromPostgres } from '@/entities/dataset';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Table, Loader2, Check, Database, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { PgConnectionConfig } from '@/lib/logic/postgres-client';
import { DataTableViewer } from '@/widgets/DataTableViewer';

interface PostgresTableBrowserProps {
  config: PgConnectionConfig | null;
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

  if (!config) return

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
      {/* ЛЕВАЯ КОЛОНКА: Список таблиц */}
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
      
      {/* ПРАВАЯ КОЛОНКА: Универсальный просмотрщик */}
      <div className="lg:col-span-2">
        <DataTableViewer
          data={previewRows}
          columns={selectedTable ? Object.keys(previewRows[0] || {}) : []}
          title={selectedTable ? `Просмотр: ${selectedTable.schema}.${selectedTable.table}` : 'Предпросмотр'}
          loading={previewLoading}
          error={null}
          emptyMessage="Выберите таблицу или данные отсутствуют"
          pageSize={20}
          enablePagination={false}
          actions={
            selectedTable && !previewLoading && (
              <Button 
                onClick={handleSync} 
                disabled={syncing} 
                size="sm" 
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {syncing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {syncing ? 'Синхронизация...' : 'Синхронизировать'}
              </Button>
            )
          }
        />
      </div>
    </div>
  );
}