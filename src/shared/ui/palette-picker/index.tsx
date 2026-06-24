'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Palette as PaletteIcon } from 'lucide-react';
import { CHART_PALETTES, DEFAULT_PALETTE_ID } from '@/shared/lib/utils/chart-palette';
import { cn } from '@/shared/lib/utils';

function Swatches({ colors, n = 6 }: { colors: string[]; n?: number }) {
  return (
    <span className="flex gap-0.5">
      {colors.slice(0, n).map((c, i) => (
        <span key={i} className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: c }} />
      ))}
    </span>
  );
}

/**
 * Выбор палитры цветов серий чарта (курируемый набор CHART_PALETTES).
 * Кнопка показывает активную палитру свотчами; клик открывает список.
 * Значение — id палитры (нет/'default' → «Стандартная»). Часть Фазы 3
 * (architecture/unified-view-config.md): хранится на группе показателей.
 */
export function PalettePicker({
  value,
  onChange,
}: {
  value?: string;
  onChange: (paletteId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeId =
    value && CHART_PALETTES.some(p => p.id === value) ? value : DEFAULT_PALETTE_ID;
  const active = CHART_PALETTES.find(p => p.id === activeId)!;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Палитра цветов чарта"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
      >
        <PaletteIcon size={14} className="text-indigo-500 shrink-0" />
        <Swatches colors={active.colors} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-30 mt-1 w-56 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1"
        >
          {CHART_PALETTES.map(p => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={p.id === activeId}
              onClick={() => {
                onChange(p.id);
                setOpen(false);
              }}
              className={cn(
                'w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors',
                p.id === activeId
                  ? 'bg-indigo-50 dark:bg-indigo-900/20'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800'
              )}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Swatches colors={p.colors} n={8} />
                <span className="truncate text-slate-700 dark:text-slate-200">{p.name}</span>
              </span>
              {p.id === activeId && <Check size={14} className="text-indigo-500 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
