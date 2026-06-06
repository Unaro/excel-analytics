import * as XLSX from 'xlsx';

export function convertExcelToCsvBuffer(fileBuffer: ArrayBuffer): { 
  csvBuffer: Uint8Array; 
  sheetNames: string[] 
} {
  const workbook = XLSX.read(fileBuffer, { 
    type: 'array',
    cellDates: true,
    raw: false
  });
  
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  const csvString = XLSX.utils.sheet_to_csv(worksheet, {
    FS: ',',              // Разделитель полей
    RS: '\n',             // Разделитель строк
    blankrows: false,     // Игнорируем пустые строки
    strip: true,          // Убираем пробелы
    dateNF: 'yyyy-mm-dd'  // Формат дат в CSV
  });
  
  return {
    csvBuffer: new TextEncoder().encode(csvString),
    sheetNames: workbook.SheetNames
  };
}