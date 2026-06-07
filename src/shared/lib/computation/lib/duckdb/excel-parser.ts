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

  for (const cellRef in worksheet) {
    if (cellRef.startsWith('!')) continue;
    const cell = worksheet[cellRef];
    
    if (cell.v instanceof Date) {
      const year = cell.v.getUTCFullYear();
      if (year === 1899) {
        let timeStr = cell.w;
        
        if (!timeStr) {
          const iso = cell.v.toISOString(); // "1899-12-31T01:01:00.000Z"
          const timePart = iso.split('T')[1].replace('.000Z', ''); // "01:01:00"
          timeStr = timePart.endsWith(':00') ? timePart.slice(0, -3) : timePart;
        }
        
        cell.t = 's';
        cell.v = timeStr;
        delete cell.w;
        delete cell.z;
      }
    }
  }
  
  const csvString = XLSX.utils.sheet_to_csv(worksheet, {
    FS: ',',
    RS: '\n',
    blankrows: false,
    strip: true,
    dateNF: 'yyyy-mm-dd'
  });
  
  return {
    csvBuffer: new TextEncoder().encode(csvString),
    sheetNames: workbook.SheetNames
  };
}