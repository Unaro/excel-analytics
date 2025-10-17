import * as XLSX from 'xlsx';

export async function parseExcelFile(file: File): Promise<{
  sheetName: string;
  headers: string[];
  rows: any[];
}[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  
  const sheets = workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length === 0) {
      return { sheetName, headers: [], rows: [] };
    }
    
    const headers = jsonData[0] as string[];
    const rows = jsonData.slice(1).map((row: any) => {
      const rowObj: any = {};
      headers.forEach((header, index) => {
        rowObj[header] = row[index] ?? null;
      });
      return rowObj;
    });
    
    return { sheetName, headers, rows };
  });
  
  return sheets;
}

export function calculateGroupMetrics(
  rows: any[],
  indicators: string[]
): { [key: string]: number } {
  const metrics: { [key: string]: number } = {};
  
  indicators.forEach(indicator => {
    const values = rows
      .map(row => parseFloat(row[indicator]))
      .filter(val => !isNaN(val));
    
    if (values.length > 0) {
      metrics[`${indicator}_sum`] = values.reduce((a, b) => a + b, 0);
      metrics[`${indicator}_avg`] = metrics[`${indicator}_sum`] / values.length;
      metrics[`${indicator}_min`] = Math.min(...values);
      metrics[`${indicator}_max`] = Math.max(...values);
      metrics[`${indicator}_count`] = values.length;
    }
  });
  
  return metrics;
}

export function applyStatisticsRule(
  rows: any[],
  column: string,
  condition: string,
  value: any,
  aggregation: string
): number {
  const filteredRows = rows.filter(row => {
    const cellValue = row[column];
    switch (condition) {
      case '=': return cellValue == value;
      case '>': return parseFloat(cellValue) > parseFloat(value);
      case '<': return parseFloat(cellValue) < parseFloat(value);
      case '>=': return parseFloat(cellValue) >= parseFloat(value);
      case '<=': return parseFloat(cellValue) <= parseFloat(value);
      case '!=': return cellValue != value;
      case 'contains': return String(cellValue).includes(String(value));
      default: return false;
    }
  });
  
  const numericValues = filteredRows
    .map(row => parseFloat(row[column]))
    .filter(val => !isNaN(val));
  
  switch (aggregation) {
    case 'sum': return numericValues.reduce((a, b) => a + b, 0);
    case 'count': return filteredRows.length;
    case 'avg': return numericValues.length > 0 
      ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length 
      : 0;
    case 'min': return Math.min(...numericValues);
    case 'max': return Math.max(...numericValues);
    default: return 0;
  }
}
