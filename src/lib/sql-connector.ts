import { ExcelRow } from '@/types';
import { SQLEngine } from '@/lib/sql-engine';

/**
 * Результат выполнения SQL запроса
 */
export interface SQLQueryResult {
  success: boolean;
  data?: {
    headers: string[];
    rows: ExcelRow[];  // Изменили тип!
  };
  error?: string;
  executionTime?: number;
}

/**
 * Интерфейс для SQL движка
 */
export interface ISQLConnector {
  executeQuery(sql: string, data: ExcelRow[], headers: string[]): SQLQueryResult;
  validateQuery(sql: string): { valid: boolean; error?: string };
}

/**
 * Текущая реализация на основе SQLEngine
 */
class NativeSQLConnector implements ISQLConnector {
  executeQuery(sql: string, data: ExcelRow[], headers: string[]): SQLQueryResult {
    const startTime = performance.now();
    
    try {
      const engine = new SQLEngine(data, headers);
      const result = engine.executeQuery(sql);
      const executionTime = performance.now() - startTime;
      
      // Получаем заголовки из первой строки результата
      const resultHeaders = result.length > 0 ? Object.keys(result[0]) : [];
      
      return {
        success: true,
        data: {
          headers: resultHeaders,
          rows: result  // Уже ExcelRow[]
        },
        executionTime
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка при выполнении запроса',
        executionTime
      };
    }
  }

  validateQuery(sql: string): { valid: boolean; error?: string } {
    // Базовая валидация SQL
    const trimmed = sql.trim().toUpperCase();
    
    if (!trimmed.startsWith('SELECT')) {
      return {
        valid: false,
        error: 'Поддерживаются только SELECT запросы'
      };
    }
    
    if (!trimmed.includes('FROM')) {
      return {
        valid: false,
        error: 'Запрос должен содержать FROM'
      };
    }
    
    // Проверка на опасные команды
    const dangerous = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE'];
    for (const cmd of dangerous) {
      if (trimmed.includes(cmd)) {
        return {
          valid: false,
          error: `Команда ${cmd} не поддерживается`
        };
      }
    }
    
    return { valid: true };
  }
}

// Singleton экземпляр
let connector: ISQLConnector;

/**
 * Получить текущий SQL коннектор
 */
export function getSQLConnector(): ISQLConnector {
  if (!connector) {
    connector = new NativeSQLConnector();
  }
  return connector;
}

/**
 * Установить кастомный SQL коннектор
 */
export function setSQLConnector(customConnector: ISQLConnector): void {
  connector = customConnector;
}
