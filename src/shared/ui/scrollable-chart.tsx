'use client';

import { ResponsiveContainer } from 'recharts';
import type { ReactElement } from 'react';

interface ScrollableChartProps {
  /** Число срезов по X (категорий/интервалов) — задаёт ширину контента. */
  slotCount: number;
  /** Минимальная ширина одного среза, px. Чарт = slotCount × slotWidth. */
  slotWidth: number;
  /** Высота бокса (фиксирована), px или CSS-значение. */
  height: number | string;
  /** Один recharts-чарт (BarChart/LineChart/…) для ResponsiveContainer. */
  children: ReactElement;
}

/**
 * Горизонтально-скроллящийся контейнер для recharts-чартов с
 * категориальной/временно́й осью X.
 *
 * При многих срезах чарт не сжимается в ширину экрана (нечитаемые бары,
 * наезжающие подписи) и не растягивает страницу: контент получает ширину
 * `slotCount × slotWidth`, а скролл живёт ВНУТРИ фикс-бокса. При малом
 * числе срезов `minWidth: 100%` растягивает чарт на всю ширину (скролла нет).
 */
export function ScrollableChart({
  slotCount,
  slotWidth,
  height,
  children,
}: ScrollableChartProps) {
  return (
    <div
      className="w-full overflow-x-auto overflow-y-hidden custom-scrollbar"
      style={{ height }}
    >
      <div
        className="h-full"
        style={{ width: Math.max(slotCount, 1) * slotWidth, minWidth: '100%' }}
      >
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
