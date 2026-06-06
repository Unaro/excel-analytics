// shared/lib/types/recharts.ts
import type { RectangleProps as RechartsRectangleProps } from 'recharts';

/**
 * Расширенный props для кастомной формы бара.
 */
export interface CustomBarShapeProps extends RechartsRectangleProps {
  value?: number | [number, number] | null;
  fill?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}