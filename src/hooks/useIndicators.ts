import { useState, useEffect, useCallback } from 'react';
import { dataStore } from '@/lib/data-store';
import type { Indicator } from '@/lib/data-store';

export function useIndicators() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [loading, setLoading] = useState(true);

  const loadIndicators = useCallback(() => {
    setLoading(true);
    const loaded = dataStore.getIndicatorLibrary();
    setIndicators(loaded);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadIndicators();
  }, [loadIndicators]);

  const addIndicator = useCallback((indicator: Indicator) => {
    dataStore.addIndicatorToLibrary(indicator);
    loadIndicators();
  }, [loadIndicators]);

  const removeIndicator = useCallback((name: string) => {
    const success = dataStore.removeIndicatorFromLibrary(name);
    if (success) {
      loadIndicators();
    }
    return success;
  }, [loadIndicators]);

  return {
    indicators,
    loading,
    addIndicator,
    removeIndicator,
    refreshIndicators: loadIndicators
  };
}
