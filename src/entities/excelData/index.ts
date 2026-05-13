// entities/excelData/index.ts

// Стор данных (алиас на универсальный)
export { useDatasetStore as useExcelDataStore, type DatasetSourceType } from '@/entities/dataset';

// Типы датасета
export * from '@/entities/dataset/model/types';

// Конфигурация колонок (остается отдельным стором)
export * from './model/column-store';
export * from './model/column-types';