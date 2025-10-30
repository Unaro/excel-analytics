import { useState, useEffect, useCallback } from 'react';
import { getFieldTypes, initializeFieldTypes, saveFieldTypes } from '@/lib/field-type-store';
import type { FieldInfo } from '@/lib/field-type-store';
import type { ExcelRow } from '@/types';

export function useFieldMetadata(headers: string[] = [], data: ExcelRow[] = []) {
  const [fieldTypes, setFieldTypes] = useState<Record<string, FieldInfo>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (headers.length === 0) {
      setLoading(false);
      return;
    }

    const initialized = initializeFieldTypes(headers, data);
    setFieldTypes(initialized);
    setLoading(false);
  }, [headers, data]);

  const updateFieldType = useCallback(
    (fieldName: string, updates: Partial<FieldInfo>) => {
      const updated: Record<string, FieldInfo> = {
        ...fieldTypes,
        [fieldName]: {
          ...fieldTypes[fieldName],
          ...updates,
        },
      };
      setFieldTypes(updated);
      saveFieldTypes(updated);
    },
    [fieldTypes]
  );

  return {
    fieldTypes,
    loading,
    updateFieldType,
  };
}
