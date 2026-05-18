// widgets/RawDataViewer/ui.tsx
'use client';
import { useMemo } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { DataTableViewer } from '@/widgets/DataTableViewer';

export function RawDataViewer() {
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  const rows = useDatasetStore(s => s.getAllData());

  const columns = useMemo(() => {
    return rows.length > 0 ? Object.keys(rows[0]) : [];
  }, [rows]);

  if (!activeDatasetId || rows.length === 0) return null;

  return (
    <DataTableViewer
      data={rows}
      columns={columns}
      title="Проверка данных"
      enablePagination={true}
      pageSize={50}
      className="min-h-[400px]"
    />
  );
}