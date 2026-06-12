'use client';

import { useRef, useState } from 'react';
import {
  BookMarked, Plus, Trash2, RefreshCw, Loader2, Database, ArrowRight,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Select, SelectOption } from '@/shared/ui/select';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { ClientOnly } from '@/shared/ui/client-only';
import { LoadingScreen } from '@/shared/ui/loading-screen';
import { toast } from '@/shared/ui/toast';
import { logger } from '@/shared/lib/logger';
import { useDatasetStore } from '@/entities/dataset';
import {
  useReferenceTypeStore,
  type KeyNormalization,
} from '@/entities/reference-type';
import type { ColumnConfig } from '@/shared/lib/types';
import {
  importDictionaryFile,
  buildDictionary,
  removeReferenceType,
  removeDictionaryDataset,
} from '../model/reference-service';

const NORMALIZATION_LABELS: Record<KeyNormalization, string> = {
  none: 'Без нормализации',
  lpad8: 'Дополнять нулями до 8 цифр',
  lpad11: 'Дополнять нулями до 11 цифр (ОКТМО/ОКАТО)',
};

/** Черновик типа между загрузкой файла и сохранением. */
interface DraftType {
  datasetId: string;
  fileName: string;
  configs: ColumnConfig[];
  name: string;
  keyColumn: string;
  displayColumn: string;
  keyNormalization: KeyNormalization;
}

export function ReferenceManager() {
  return (
    <ClientOnly fallback={<LoadingScreen message="Загрузка справочников..." />}>
      <ReferenceManagerContent />
    </ClientOnly>
  );
}

function ReferenceManagerContent() {
  const types = useReferenceTypeStore(s => s.types);
  const datasets = useDatasetStore(s => s.datasets);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [draft, setDraft] = useState<DraftType | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [rebuildingId, setRebuildingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const handleFile = async (file: File) => {
    setIsImporting(true);
    const toastId = `ref-import-${Date.now()}`;
    toast.loading(`Загрузка справочника «${file.name}»...`, { id: toastId });
    try {
      const res = await importDictionaryFile(file);
      if (!res.success || !res.datasetId || !res.configs) {
        toast.error(`Ошибка: ${res.error ?? 'не удалось загрузить файл'}`, { id: toastId });
        return;
      }
      toast.success('Файл загружен — настройте сопоставление', { id: toastId });
      setDraft({
        datasetId: res.datasetId,
        fileName: file.name,
        configs: res.configs,
        name: file.name.replace(/\.[^.]+$/, ''),
        keyColumn: res.configs[0]?.columnName ?? '',
        displayColumn: res.configs[1]?.columnName ?? res.configs[0]?.columnName ?? '',
        keyNormalization: 'lpad11',
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const cancelDraft = async () => {
    if (!draft) return;
    // Файл без типа никому не нужен — убираем служебный датасет
    await removeDictionaryDataset(draft.datasetId);
    setDraft(null);
  };

  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.warning('Укажите название типа');
      return;
    }
    if (draft.keyColumn === draft.displayColumn) {
      toast.warning('Колонки кода и наименования должны различаться');
      return;
    }
    setIsSaving(true);
    try {
      const typeId = useReferenceTypeStore.getState().addType({
        name: draft.name.trim(),
        dictionaryDatasetId: draft.datasetId,
        keyColumn: draft.keyColumn,
        displayColumn: draft.displayColumn,
        keyNormalization: draft.keyNormalization,
      });
      const type = useReferenceTypeStore.getState().getType(typeId);
      if (!type) throw new Error('Тип не сохранился');
      const count = await buildDictionary(type);
      toast.success(`Тип «${draft.name}» создан: ${count.toLocaleString('ru-RU')} записей`);
      setDraft(null);
    } catch (err) {
      logger.error('[ReferenceManager] Save failed:', err);
      toast.error(err instanceof Error ? err.message : 'Не удалось построить словарь');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRebuild = async (typeId: string) => {
    const type = useReferenceTypeStore.getState().getType(typeId);
    if (!type) return;
    setRebuildingId(typeId);
    try {
      const count = await buildDictionary(type);
      toast.success(`Словарь пересобран: ${count.toLocaleString('ru-RU')} записей`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось пересобрать словарь');
    } finally {
      setRebuildingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const type = useReferenceTypeStore.getState().getType(deleteTarget.id);
    await removeReferenceType(deleteTarget.id);
    // Если на датасет-справочник больше никто не ссылается — убираем и его
    if (type) {
      const remaining = useReferenceTypeStore
        .getState()
        .getTypesByDictionary(type.dictionaryDatasetId);
      if (remaining.length === 0) {
        await removeDictionaryDataset(type.dictionaryDatasetId);
      }
    }
    toast.info(`Тип «${deleteTarget.name}» удалён`);
    setDeleteTarget(null);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Справочники</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Пользовательские типы колонок: код → наименование (ОКТМО, ОКАТО и другие)
          </p>
        </div>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting || !!draft}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {isImporting
            ? <Loader2 size={18} className="mr-2 animate-spin" />
            : <Plus size={18} className="mr-2" />}
          Загрузить справочник
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

      {/* Настройка нового типа после загрузки файла */}
      {draft && (
        <Card className="p-6 space-y-5 border-indigo-200 dark:border-indigo-900 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <BookMarked size={18} className="text-indigo-500" />
            Новый тип из «{draft.fileName}»
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium mb-1.5 block">Название типа</label>
              <Input
                value={draft.name}
                onChange={e => setDraft({ ...draft, name: e.target.value })}
                placeholder="Например: ОКТМО"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Колонка с кодом</label>
              <Select
                value={draft.keyColumn}
                onChange={e => setDraft({ ...draft, keyColumn: e.target.value })}
              >
                {draft.configs.map(c => (
                  <SelectOption key={c.columnName} value={c.columnName}>
                    {c.displayName}
                  </SelectOption>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Колонка с наименованием</label>
              <Select
                value={draft.displayColumn}
                onChange={e => setDraft({ ...draft, displayColumn: e.target.value })}
              >
                {draft.configs.map(c => (
                  <SelectOption key={c.columnName} value={c.columnName}>
                    {c.displayName}
                  </SelectOption>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium mb-1.5 block">Нормализация кода</label>
              <Select
                value={draft.keyNormalization}
                onChange={e =>
                  setDraft({ ...draft, keyNormalization: e.target.value as KeyNormalization })
                }
              >
                {(Object.keys(NORMALIZATION_LABELS) as KeyNormalization[]).map(n => (
                  <SelectOption key={n} value={n}>{NORMALIZATION_LABELS[n]}</SelectOption>
                ))}
              </Select>
              <p className="text-xs text-slate-400 mt-1.5">
                Excel теряет ведущие нули числовых кодов («01512…» → «1512…») —
                дополнение нулями восстанавливает соответствие со справочником.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={cancelDraft} disabled={isSaving}>
              Отмена
            </Button>
            <Button
              onClick={saveDraft}
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isSaving && <Loader2 size={16} className="mr-2 animate-spin" />}
              Создать тип
            </Button>
          </div>
        </Card>
      )}

      {/* Список типов */}
      <div className="grid gap-4">
        {types.length === 0 && !draft && (
          <Card className="p-12 text-center border-dashed">
            <BookMarked size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">
              Нет справочников. Загрузите CSV/Excel с кодами и наименованиями —
              и назначайте тип колонкам в настройке датасета.
            </p>
          </Card>
        )}

        {types.map(type => (
          <Card key={type.id} className="p-5 flex items-center justify-between group">
            <div className="flex items-center gap-4 min-w-0">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
                <BookMarked size={22} />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 dark:text-white">{type.name}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    <Database size={10} />
                    {datasets[type.dictionaryDatasetId]?.name ?? 'файл удалён'}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono">
                    {type.keyColumn} <ArrowRight size={10} /> {type.displayColumn}
                  </span>
                  {type.entryCount !== undefined && (
                    <span>{type.entryCount.toLocaleString('ru-RU')} записей</span>
                  )}
                  <span className="opacity-70">{NORMALIZATION_LABELS[type.keyNormalization]}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 opacity-70 group-hover:opacity-100 transition-opacity shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRebuild(type.id)}
                disabled={rebuildingId === type.id}
                title="Пересобрать словарь из файла"
              >
                <RefreshCw size={14} className={rebuildingId === type.id ? 'animate-spin' : ''} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-red-500"
                onClick={() => setDeleteTarget({ id: type.id, name: type.name })}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={v => !v && setDeleteTarget(null)}
        title={`Удалить тип «${deleteTarget?.name ?? ''}»?`}
        description="Колонки с этим типом снова будут показывать коды вместо наименований. Файл справочника будет удалён, если на него не ссылаются другие типы."
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
