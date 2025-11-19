import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval'; // <--- Импортируем
import type { SheetData, ExcelMetadata, ExcelRow, ColumnStatistics } from '@/types';

// 1. Создаем адаптер для IndexedDB
const storage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    console.log(name, 'has been retrieved');
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    console.log(name, 'with value', value, 'has been saved');
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    console.log(name, 'has been deleted');
    await del(name);
  },
};

interface ExcelDataState {
  data: SheetData[] | null;
  metadata: ExcelMetadata | null;
  
  // Действия
  setData: (data: SheetData[], metadata: ExcelMetadata) => void;
  clearData: () => void;
  
  // Геттеры
  getSheetData: (sheetName: string) => ExcelRow[];
  getAllData: () => ExcelRow[];
  getSheetNames: () => string[];
  getHeaders: (sheetName?: string) => string[];
  hasData: () => boolean;
  getColumnStatistics: (columnName: string) => ColumnStatistics | null;
}

export const useExcelDataStore = create<ExcelDataState>()(
  persist(
    (set, get) => ({
      data: null,
      metadata: null,
      
      setData: (data, metadata) => set({ data, metadata }),
      
      clearData: () => set({ data: null, metadata: null }),
      
      getSheetData: (sheetName: string) => {
        const data = get().data;
        if (!data) return [];
        const sheet = data.find((s) => s.sheetName === sheetName);
        return sheet?.rows ?? [];
      },
      
      getAllData: () => {
        const data = get().data;
        if (!data) return [];
        return data.flatMap((sheet) => sheet.rows);
      },
      
      getSheetNames: () => {
        const data = get().data;
        if (!data) return [];
        return data.map((sheet) => sheet.sheetName);
      },
      
      getHeaders: (sheetName?: string) => {
        const data = get().data;
        if (!data || data.length === 0) return [];
        if (sheetName) {
          const sheet = data.find((s) => s.sheetName === sheetName);
          return sheet?.headers ?? [];
        }
        return data[0].headers;
      },
      
      hasData: () => {
        const data = get().data;
        return !!data && data.length > 0;
      },
      
      getColumnStatistics: (columnName: string) => {
        const allData = get().getAllData();
        if (allData.length === 0) return null;
        
        // Простая статистика на лету
        const values = allData.map(row => row[columnName]).filter(v => v != null);
        const numericValues = values.filter(v => typeof v === 'number') as number[];
        const uniqueValues = new Set(values);
        
        const statistics: ColumnStatistics = {
          columnName,
          totalValues: values.length,
          nullCount: allData.length - values.length,
          uniqueCount: uniqueValues.size,
          numericCount: numericValues.length,
          textCount: values.length - numericValues.length,
          booleanCount: 0,
          dateCount: 0,
          sampleValues: Array.from(uniqueValues).slice(0, 5),
        };
        
        return statistics;
      },
    }),
    {
      name: 'excel-data-storage', // Имя ключа в БД
      storage: createJSONStorage(() => storage), // Используем IndexedDB
      skipHydration: true, // ВАЖНО: отключаем авто-гидратацию при старте, чтобы избежать рассинхрона
    }
  )
);