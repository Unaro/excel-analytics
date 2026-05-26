'use client';
import { useState, useCallback, useMemo } from 'react';
import { MathNode } from 'mathjs';
import { useColumnConfigStore } from '@/entities/columnConfig';
import { ColumnConfig, useDatasetStore } from '@/entities/dataset';
import { extractVariables, validateFormula } from '@/shared/lib/math/safe-math';

interface MathSymbolNode extends MathNode {
  name: string;
}

const EMPTY_COLUMNS: ColumnConfig[] = [];

export function useFormulaValidation() {
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  
  const configs = useColumnConfigStore(s => 
    activeDatasetId ? (s.configsByDataset[activeDatasetId] ?? EMPTY_COLUMNS) : EMPTY_COLUMNS
  );

  const numericColumns = useMemo(() => {
    return configs.filter((c: ColumnConfig) => c.classification === 'numeric');
  }, [configs]);

  const [isValid, setIsValid] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dependencies, setDependencies] = useState<string[]>([]);

  const availableVariables = useMemo(() => {
    return numericColumns.map((c: ColumnConfig) => ({
      name: c.alias,
      type: 'field',
      display: c.displayName
    }));
  }, [numericColumns]);

  const validate = useCallback((formula: string) => {
    if (!formula.trim()) {
      setIsValid(false);
      setError('Формула не может быть пустой');
      setDependencies([]);
      return;
    }
    try {
      validateFormula(formula);
      setDependencies(extractVariables(formula));
      setIsValid(true);
      setError(null);
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