// src/hooks/useColumnStats.ts
'use client';

import { useMemo } from 'react';
import { DataRow, ColumnStatsMap } from '@/types/data-table';

interface UseColumnStatsProps {
  data: DataRow[];
  selectedColumns: Set<string>;
}

export function useColumnStats({ data, selectedColumns }: UseColumnStatsProps): ColumnStatsMap {
  return useMemo(() => {
    const stats: ColumnStatsMap = {};
    
    selectedColumns.forEach(column => {
      const numericValues = data
        .map(row => row[column])
        .filter((val): val is number => typeof val === 'number' && !isNaN(val));

      if (numericValues.length > 0) {
        const sum = numericValues.reduce((a, b) => a + b, 0);
        
        stats[column] = {
          sum,
          avg: sum / numericValues.length,
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          count: numericValues.length,
        };
      }
    });

    return stats;
  }, [data, selectedColumns]);
}
