'use server';

import { parseExcelFile } from '@/lib/excel-parser';
import { SheetData } from '@/types';

let globalData: SheetData[] | null = null;

export async function uploadExcel(formData: FormData) {
  try {
    const file = formData.get('file') as File;
    
    if (!file) {
      return { error: 'Файл не найден' };
    }
    
    const sheets = await parseExcelFile(file);
    globalData = sheets;
    
    return { success: true, data: sheets };
  } catch (error) {
    console.error('Ошибка обработки файла:', error);
    return { error: 'Ошибка при обработке файла' };
  }
}

export async function getData() {
  return globalData;
}

export async function clearData() {
  globalData = null;
  return { success: true };
}
