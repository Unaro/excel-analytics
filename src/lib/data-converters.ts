import { ExcelRow } from '@/types';
import { ChartDataPoint, PieChartData } from '@/types/dashboard';

/**
 * Конвертирует ExcelRow в ChartDataPoint
 * Добавляет обязательное поле name из указанной колонки
 */
export function excelRowToChartDataPoint(
  row: ExcelRow,
  nameColumn: string = 'name'
): ChartDataPoint {
  const result: ChartDataPoint = {
    name: String(row[nameColumn] || 'Unnamed'),
  };

  // Копируем все поля, но только string и number
  Object.entries(row).forEach(([key, value]) => {
    if (typeof value === 'string' || typeof value === 'number') {
      result[key] = value;
    } else if (typeof value === 'boolean') {
      result[key] = value ? 1 : 0; // Конвертируем boolean в number
    }
  });

  return result;
}

/**
 * Конвертирует массив ExcelRow в ChartDataPoint[]
 */
export function excelRowsToChartDataPoints(
  rows: ExcelRow[],
  nameColumn: string = 'name'
): ChartDataPoint[] {
  return rows.map(row => excelRowToChartDataPoint(row, nameColumn));
}

/**
 * Конвертирует ChartDataPoint в PieChartData
 * Извлекает value из указанного поля
 */
export function chartDataPointToPieData(
  dataPoint: ChartDataPoint,
  valueField: string = 'value'
): PieChartData {
  const value = dataPoint[valueField];
  return {
    name: dataPoint.name,
    value: typeof value === 'number' ? value : 0,
  };
}

/**
 * Конвертирует массив ChartDataPoint в PieChartData[]
 */
export function chartDataPointsToPieData(
  dataPoints: ChartDataPoint[],
  valueField: string = 'value'
): PieChartData[] {
  return dataPoints.map(dp => chartDataPointToPieData(dp, valueField));
}
