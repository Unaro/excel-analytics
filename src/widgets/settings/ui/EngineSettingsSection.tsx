'use client';

import { Card } from '@/shared/ui/card';
import { Select, SelectOption } from '@/shared/ui/select';
import { Cpu } from 'lucide-react';
import { useAppSettingsStore } from '@/entities/app-settings';

const AUTO = 'auto';

/** Варианты потолка памяти DuckDB (МБ). null — без явного лимита. */
const MEMORY_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Авто (без лимита)' },
  { value: 256, label: '256 МБ' },
  { value: 512, label: '512 МБ' },
  { value: 1024, label: '1 ГБ' },
  { value: 2048, label: '2 ГБ' },
  { value: 4096, label: '4 ГБ' },
];

/**
 * Настройки движка DuckDB: потолок памяти.
 *
 * На слабых устройствах меньший `memory_limit` снижает пиковую память
 * (ценой возможного замедления больших запросов). Значение уезжает в воркер
 * (CONFIGURE_ENGINE) и применяется как `SET memory_limit`. Управление
 * потоками недоступно: wasm-сборка EH скомпилирована без поддержки потоков.
 */
export function EngineSettingsSection() {
  const memoryLimitMB = useAppSettingsStore((s) => s.duckdbMemoryLimitMB);
  const setMemoryLimitMB = useAppSettingsStore((s) => s.setDuckdbMemoryLimitMB);

  return (
    <Card className="p-6 border-l-4 border-l-emerald-500">
      <div className="flex items-start gap-4">
        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg">
          <Cpu size={20} />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Движок DuckDB (память)
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              На слабых устройствах можно ограничить память, чтобы обработать
              большой файл ценой скорости. Применяется к локальному движку
              в браузере; PostgreSQL это не затрагивает.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block text-slate-700 dark:text-slate-300">
                Потолок памяти
              </label>
              <Select
                value={memoryLimitMB ?? AUTO}
                onChange={(e) =>
                  setMemoryLimitMB(e.target.value === AUTO ? null : Number(e.target.value))
                }
              >
                {MEMORY_OPTIONS.map((opt) => (
                  <SelectOption key={opt.label} value={opt.value ?? AUTO}>
                    {opt.label}
                  </SelectOption>
                ))}
              </Select>
              <p className="text-xs text-slate-400 mt-1.5">
                Ниже лимит — меньше пик памяти, но тяжёлые запросы могут
                замедлиться или упереться в потолок.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
