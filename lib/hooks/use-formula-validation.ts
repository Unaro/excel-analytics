'use client';

import { useState, useCallback, useMemo } from 'react';
import { parse, MathNode } from 'mathjs';
import { useColumnConfigStore } from '@/lib/stores/column-config-store';
import { useMetricTemplateStore } from '@/lib/stores/metric-template-store';

// Расширяем базовый тип для TypeScript
interface MathSymbolNode extends MathNode {
  name: string;
}

export function useFormulaValidation() {
  // ИСПРАВЛЕНИЕ:
  // 1. Берем сырой массив конфигов (ссылка на него стабильна)
  const configs = useColumnConfigStore((s) => s.configs);

  // 2. Фильтруем нужные колонки через useMemo
  // Пересчет произойдет только если реально изменится список колонок
  const numericColumns = useMemo(() => {
    return configs.filter(c => c.classification === 'numeric');
  }, [configs]);
  
  // Доступные шаблоны
  const templates = useMetricTemplateStore((s) => s.templates);

  const [isValid, setIsValid] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dependencies, setDependencies] = useState<string[]>([]);

  // Список всех доступных переменных для подсказок в UI
  const availableVariables = useMemo(() => {
    const vars = [
      ...numericColumns.map(c => ({ 
        name: c.alias, 
        type: 'field', 
        display: c.displayName 
      })),
    ];
    return vars;
  }, [numericColumns]);

  const validate = useCallback((formula: string) => {
    if (!formula.trim()) {
      setIsValid(false);
      setError('Формула не может быть пустой');
      setDependencies([]);
      return;
    }

    try {
      const node = parse(formula);
      const foundDeps = new Set<string>();
      
      node.traverse(function (node: MathNode, path: string, parent: MathNode) {
        if (node.type === 'SymbolNode') {
           const symbolNode = node as unknown as MathSymbolNode;
           
           if (typeof symbolNode.name === 'string') {
             const builtIns = [
               'sqrt', 'pow', 'max', 'min', 'abs', 'round', 
               'floor', 'ceil', 'log', 'exp', 'sin', 'cos', 'tan'
             ];
             
             if (!builtIns.includes(symbolNode.name)) {
               foundDeps.add(symbolNode.name);
             }
           }
        }
      });
      
      setDependencies(Array.from(foundDeps));
      setIsValid(true);
      setError(null);
    } catch (err) {
      setIsValid(false);
      setError(err instanceof Error ? err.message : 'Ошибка синтаксиса формулы');
      setDependencies([]);
    }
  }, []);

  return {
    validate,
    isValid,
    error,
    dependencies,
    availableVariables
  };
}