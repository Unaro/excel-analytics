'use client';

import { useState, useCallback, useMemo } from 'react';
import { parse, MathNode } from 'mathjs';
import { useColumnConfigStore } from '@/entities/columnConfig';
import { extractVariables, validateFormula } from '../logic/safe-math';
import { useDatasetStore } from '@/entities/dataset';
import type { ColumnConfig } from '@/types';

// Расширяем базовый тип для TypeScript
interface MathSymbolNode extends MathNode {
  name: string;
}

export function useFormulaValidation() {
  // 1. Берем сырой массив конфигов
  
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  const configs = useColumnConfigStore(s => activeDatasetId ? (s.configsByDataset[activeDatasetId] || []) : []);
  const numericColumns = useMemo(() => {
    return configs.filter((c: ColumnConfig) => c.classification === 'numeric');
  }, [configs, activeDatasetId]);

  const [isValid, setIsValid] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dependencies, setDependencies] = useState<string[]>([]);

  // Список всех доступных переменных для подсказок в UI
  const availableVariables = useMemo(() => {
    const vars = [
      ...numericColumns.map((c: ColumnConfig) => ({
        name: c.alias, 
        type: 'field', 
        display: c.displayName 
      })),
    ];
    return vars;
  }, [numericColumns]);

  const validate = useCallback((formula: string) => {
    if (!formula.trim()) {
      setIsValid(false); setError('Формула не может быть пустой'); setDependencies([]);
      return;
    }
    try {
      validateFormula(formula);
      setDependencies(extractVariables(formula));
      setIsValid(true); setError(null);
    } catch (err) {
      setIsValid(false);
      setError(err instanceof Error ? err.message : 'Ошибка синтаксиса');
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