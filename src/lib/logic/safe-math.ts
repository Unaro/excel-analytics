/**
 * Безопасная работа с формулами mathjs
 * 
 * Предотвращает XSS атаки через выполнение вредоносного кода
 */
import { create, all, parse, type MathNode, FunctionNode, SymbolNode } from 'mathjs';

// Создаём инстанс mathjs
export const safeMath = create(all);

// Белый список разрешённых функций для формул
const ALLOWED_FUNCTIONS = new Set([
  // Арифметика
  'add', 'subtract', 'multiply', 'divide', 'mod', 'pow', 'sqrt', 'abs',
  
  // Агрегации
  'sum', 'mean', 'median', 'min', 'max',
  
  // Математика
  'round', 'floor', 'ceil', 'sign', 'exp', 'log', 'log10',
  
  // Тригонометрия
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  
  // Логика
  'equal', 'unequal', 'smaller', 'larger', 'smallerEq', 'largerEq',
  
  // Условия
  'if',
  
  // Утилиты
  'format', 'bin', 'oct', 'hex',
]);

// Опасные паттерны в именах переменных
const DANGEROUS_PATTERNS = [
  'process',
  'require',
  'import',
  'global',
  'eval',
  'Function',
  '__proto__',
  'constructor',
  'prototype',
  'window',
  'document',
  'localStorage',
  'sessionStorage',
];

/**
 * Ошибка валидации формулы
 */
export class FormulaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormulaValidationError';
  }
}

/**
 * Валидация AST дерева формулы
 * 
 * @param formula - Формула для валидации
 * @throws FormulaValidationError если формула содержит опасный код
 */
export function validateFormula(formula: string): void {
  if (!formula || typeof formula !== 'string') {
    throw new FormulaValidationError('Формула должна быть непустой строкой');
  }

  // Проверка на максимальную длину
  if (formula.length > 1000) {
    throw new FormulaValidationError('Формула слишком длинная (максимум 1000 символов)');
  }

  try {
    const node = parse(formula);
    
    // Рекурсивно обходим AST дерево
    node.traverse((node: MathNode) => {
      // Проверяем вызовы функций
      if (node instanceof FunctionNode) {
        if (node.fn instanceof SymbolNode) {
          const funcName = node.fn.name;
          
          if (!ALLOWED_FUNCTIONS.has(funcName)) {
            throw new FormulaValidationError(
              `Функция "${funcName}" запрещена. Разрешены: ${Array.from(ALLOWED_FUNCTIONS).join(', ')}`
            );
          }
        } else {
          // Функция получена через выражение (например, math['sin'](x))
          throw new FormulaValidationError('Динамический вызов функций запрещён');
        }
      }
      
      // Проверяем имена переменных
      if (node instanceof SymbolNode) {
        const name = node.name;
        
        // Проверка на опасные паттерны
        const hasDangerousPattern = DANGEROUS_PATTERNS.some(pattern => 
          name.toLowerCase().includes(pattern.toLowerCase())
        );
        
        if (hasDangerousPattern) {
          throw new FormulaValidationError(
            `Переменная "${name}" содержит опасное имя`
          );
        }
        
        // Проверка на специальные символы (кроме подчёркивания и $)
        if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
          throw new FormulaValidationError(
            `Переменная "${name}" содержит недопустимые символы`
          );
        }
      }
    });
  } catch (error) {
    if (error instanceof FormulaValidationError) {
      throw error;
    }
    throw new FormulaValidationError(`Ошибка парсинга формулы: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
  }
}

/**
 * Безопасное вычисление формулы
 * 
 * @param formula - Формула для вычисления
 * @param scope - Объект с переменными
 * @returns Результат вычисления или null при ошибке
 */
export function safeEvaluate(
  formula: string, 
  scope: Record<string, number | null>
): number | null {
  try {
    // Сначала валидация
    validateFormula(formula);
    
    // Проверяем, что все значения в scope — числа или null
    for (const [key, value] of Object.entries(scope)) {
      if (value !== null && typeof value !== 'number') {
        console.warn(`Значение переменной "${key}" должно быть числом, получено: ${typeof value}`);
      }
    }
    
    // Создаём безопасный scope только с числами
    const safeScope: Record<string, number> = {};
    for (const [key, value] of Object.entries(scope)) {
      if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
        safeScope[key] = value;
      } else {
        safeScope[key] = 0;
      }
    }
    
    // Вычисляем только если всё безопасно
    const result = safeMath.evaluate(formula, safeScope);
    
    if (typeof result === 'number') {
      if (!isFinite(result) || isNaN(result)) {
        return null;
      }
      return result;
    }
    
    return null;
  } catch (error) {
    console.error('Formula evaluation error:', error);
    return null;
  }
}

/**
 * Проверка формулы на наличие циклических зависимостей
 */
export function formulaDependsOn(
  formula: string, 
  variableName: string
): boolean {
  try {
    const node = parse(formula);
    let depends = false;
    
    node.traverse((node: MathNode) => {
      if (node instanceof SymbolNode && node.name === variableName) {
        depends = true;
      }
    });
    
    return depends;
  } catch {
    return false;
  }
}

/**
 * Извлечение всех переменных из формулы
 */
export function extractVariables(formula: string): string[] {
  try {
    const node = parse(formula);
    const variables = new Set<string>();
    
    node.traverse((node: MathNode) => {
      if (node instanceof SymbolNode) {
        variables.add(node.name);
      }
    });
    
    return Array.from(variables);
  } catch {
    return [];
  }
}
