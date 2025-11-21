// lib/utils/format.ts

export function formatCompactNumber(number: number): string {
  return new Intl.NumberFormat('ru-RU', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(number);
}

export function formatNumber(number: number, decimals = 1): string {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: decimals,
  }).format(number);
}