'use client';

import type { ReactNode } from 'react';

export interface ChartTooltipRow {
  /** Цвет маркера серии (обычно entry.color recharts). */
  color: string;
  /** Подпись серии — имя метрики (1-D) или категории (2-D). */
  name: string;
  /** Уже отформатированное значение (формат/единицу применяет вызывающий). */
  value: string;
}

/**
 * Тема-зависимая плашка тултипа recharts (Style A: «подпись ↔ значение» в строку).
 *
 * Общая для 1-D bar/radar (group-view/ui/Chart) и 2-D pivot (time-breakdown):
 * раньше — три копии одинаковой разметки. Контент-строки готовит вызывающий
 * (источник имени/формата и фильтр порогов у каждого свой — это законное
 * отличие), а саму плашку рисует этот компонент. `dark:`-классы обязательны:
 * recharts по умолчанию даёт светлую плашку (`var(--tooltip-bg)` не задаётся).
 *
 * Пустой `rows` → `null` (заменяет прежнюю проверку «filtered.length === 0»).
 * Часть общего стиль-субстрата (architecture/unified-view-config.md, Фаза 1).
 */
export function ChartTooltip({ title, rows }: { title: ReactNode; rows: ChartTooltipRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded shadow-xl text-xs">
      <div className="font-bold text-slate-900 dark:text-white mb-2">{title}</div>
      {rows.map((r, i) => (
        <div key={i} className="flex justify-between gap-3">
          <span style={{ color: r.color }}>{r.name}</span>
          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
