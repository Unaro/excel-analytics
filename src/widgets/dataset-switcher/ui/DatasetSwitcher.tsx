'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import * as Popover from '@radix-ui/react-popover';
import { useDatasetStore } from '@/entities/dataset';
import { Button } from '@/shared/ui/button';
import {
  Database, Trash2, ChevronDown, Check, FileSpreadsheet,
  Loader2, Plus, RefreshCw,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';
import { refreshPgDataset } from '@/features/setup-dataset';

interface DatasetSwitcherProps {
  isDisabled?: boolean;
}

export function DatasetSwitcher({ isDisabled = false }: DatasetSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const datasets = useDatasetStore(s => s.datasets);
  const activeId = useDatasetStore(s => s.activeDatasetId);
  const switchDataset = useDatasetStore(s => s.switchDataset);
  const removeDataset = useDatasetStore(s => s.removeDataset);
  const isSyncing = useDatasetStore(s => s.isSyncing);

  const activeDataset = activeId ? datasets[activeId] : null;
  const datasetList = Object.values(datasets);

  const StatusDot = ({ status }: { status?: string }) => {
    if (status === 'online') return <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />;
    if (status === 'offline') return <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)] animate-pulse" />;
    if (status === 'checking') return <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />;
    return <span className="w-2 h-2 rounded-full bg-slate-400" />;
  };

  const handleSwitch = (id: string) => {
    if (isDisabled) return;
    if (id !== activeId) {
      switchDataset(id);
      if (['/dashboards', '/hierarchy', '/groups'].some(p => pathname?.startsWith(p))) {
        router.refresh();
      }
      toast.success('Датасет переключен');
    }
    setOpen(false);
  };

  const handleRemove = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      `Удалить датасет "${name}"?\n⚠️ Это удалит только данные.\nНастройки дашбордов, метрики и группы сохранятся.`
    );
    if (confirmed) {
      removeDataset(id);
      toast.info(`Датасет "${name}" удален`);
      if (id === activeId) {
        const remainingIds = Object.keys(datasets).filter(k => k !== id);
        if (remainingIds.length > 0) {
          switchDataset(remainingIds[0]);
        } else {
          if (pathname?.startsWith('/setup')) {
            sessionStorage.setItem('setup-step', 'upload');
          }
          router.push('/setup');
        }
      }
      setOpen(false);
    }
  };

  const handleAddNew = () => {
    setOpen(false);
    router.push('/setup');
  };

  const handleRefresh = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRefreshingId(id);
    try {
      const res = await refreshPgDataset(id);
      if (res?.success) {
        if (['/dashboards', '/hierarchy', '/groups'].some(p => pathname?.startsWith(p))) {
          router.refresh();
        }
      }
    } catch (err) {
      console.error('[DatasetSwitcher] Refresh failed:', err);
    } finally {
      setRefreshingId(null);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={(v) => !isDisabled && setOpen(v)}>
      <Popover.Trigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isDisabled}
          className={cn(
            'w-full justify-between gap-2 h-auto py-2.5 px-3',
            'border-slate-200 dark:border-slate-700',
            'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800',
            open && 'ring-2 ring-indigo-500 border-indigo-300 dark:border-indigo-700',
            isDisabled && 'opacity-60 cursor-not-allowed'
          )}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {activeDataset?.sourceType === 'postgres' && (
              <div className="relative">
                <Database
                  size={16}
                  className={cn(
                    'shrink-0 transition-colors',
                    activeDataset.pgStatus === 'offline'
                      ? 'text-red-500'
                      : 'text-indigo-600 dark:text-indigo-400'
                  )}
                />
                <div className="absolute -bottom-0.5 -right-0.5">
                  <StatusDot status={activeDataset.pgStatus} />
                </div>
              </div>
            )}
            {activeDataset?.sourceType === 'file' && (
              <FileSpreadsheet
                size={16}
                className="shrink-0 transition-colors text-indigo-600 dark:text-indigo-400"
              />
            )}
            <div className="text-left min-w-0 flex-1">
              {isSyncing ? (
                <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <Loader2 size={12} className="animate-spin" />
                  Синхронизация...
                </span>
              ) : activeDataset ? (
                <>
                  <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                    {activeDataset.name}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span className="truncate">
                      {activeDataset.metadata?.totalRows ?? 0} строк
                    </span>
                  </div>
                </>
              ) : (
                <span className="text-xs text-slate-400">Нет датасета</span>
              )}
            </div>
          </div>
          <ChevronDown
            size={14}
            className={cn(
              'text-slate-400 shrink-0 transition-transform',
              open && 'rotate-180'
            )}
          />
          {isDisabled && (
            <span className="ml-2 text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              Привязан к дашборду
            </span>
          )}
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={10}
          className={cn(
            'w-[--radix-popover-trigger-width] min-w-[280px] max-w-sm',
            'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700',
            'rounded-xl shadow-2xl overflow-hidden',
            'origin-[--radix-popover-content-transform-origin]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
            'z-[9999]'
          )}
        >
          {/* Хедер дропдауна */}
          <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Доступные датасеты
              </span>
              <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                {datasetList.length}
              </span>
            </div>
          </div>

          {/* Список датасетов */}
          <div className="max-h-[280px] overflow-y-auto custom-scrollbar p-1.5 space-y-1">
            {datasetList.length === 0 ? (
              <div className="py-6 px-3 text-center">
                <Database size={24} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-xs text-slate-400 mb-3">Нет загруженных датасетов</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddNew}
                  className="w-full h-8 text-xs"
                >
                  <Plus size={14} className="mr-1" /> Загрузить
                </Button>
              </div>
            ) : (
              datasetList.map((ds) => {
                const isActive = ds.id === activeId;
                return (
                  <div
                    key={ds.id}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-lg transition-all cursor-pointer group',
                      'border border-transparent',
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700'
                    )}
                    onClick={() => handleSwitch(ds.id)}
                  >
                    <div className="flex items-center gap-2">
                      {ds.sourceType === 'file' ? <FileSpreadsheet size={14} /> : <Database size={14} />}
                      {ds.sourceType === 'postgres' && <StatusDot status={ds.pgStatus} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'text-sm font-medium truncate',
                            isActive
                              ? 'text-indigo-700 dark:text-indigo-300'
                              : 'text-slate-700 dark:text-slate-200'
                          )}
                        >
                          {ds.name}
                        </span>
                        {isActive && (
                          <Check size={12} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>{ds.metadata?.totalRows ?? 0} строк</span>
                        {ds.metadata?.totalColumns && (
                          <span>• {ds.metadata.totalColumns} колонок</span>
                        )}
                      </div>
                    </div>

                    {ds.sourceType === 'postgres' && (
                      <button
                        onClick={(e) => handleRefresh(ds.id, e)}
                        disabled={refreshingId === ds.id}
                        className={cn(
                          'p-1.5 rounded-md transition-all opacity-0 group-hover:opacity-100',
                          'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20',
                          refreshingId === ds.id && 'animate-spin cursor-wait'
                        )}
                        title="Обновить данные из БД"
                      >
                        {refreshingId === ds.id ? <Loader2 size={14} /> : <RefreshCw size={14} />}
                      </button>
                    )}

                    <button
                      onClick={(e) => handleRemove(ds.id, ds.name, e)}
                      className={cn(
                        'p-1.5 rounded-md transition-all opacity-0 group-hover:opacity-100',
                        'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                      )}
                      title="Удалить датасет"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Футер дропдауна */}
          <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddNew}
              className="w-full h-8 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 justify-start"
            >
              <Plus size={14} className="mr-2" /> Добавить новый датасет
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}