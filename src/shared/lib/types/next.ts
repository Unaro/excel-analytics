// shared/lib/types/next.ts
import type { JSX } from 'react';

/**
 * Базовые props для динамических страниц Next.js 15 App Router.
 * 
 * В Next.js 15 params и searchParams стали Promise-ами для поддержки streaming.
 * Этот тип переиспользуется во всех динамических маршрутах:
 * - app/dashboards/[id]/page.tsx
 * - app/groups/[id]/page.tsx
 * - app/dashboards/[id]/edit/page.tsx
 * - и т.д.
 * 
 * @template T - Кортеж имён динамических сегментов
 * @example
 * ```ts
 * // app/dashboards/[id]/page.tsx
 * export default function Page({ params }: DynamicPageProps<['id']>) { ... }
 * 
 * // app/dashboards/[dashboardId]/widgets/[widgetId]/page.tsx
 * export default function Page({ params }: DynamicPageProps<['dashboardId', 'widgetId']>) { ... }
 * ```
 */
export interface DynamicPageProps<T extends readonly string[] = ['id']> {
  params: Promise<Record<T[number], string>>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Props для статических страниц (без динамических сегментов).
 * Используется для страниц типа /dashboards, /groups, /metrics.
 */
export interface StaticPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Утилита для извлечения params с типизацией.
 * Используется в async Server Components.
 */
export async function extractParams<T extends readonly string[]>(
  params: Promise<Record<T[number], string>>
): Promise<Record<T[number], string>> {
  return params;
}