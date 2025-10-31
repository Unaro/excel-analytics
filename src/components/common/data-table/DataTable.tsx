// src/components/common/data-table/DataTable.tsx
import { DataRow, ColumnConfig, ViewMode } from '@/types/data-table';

interface DataTableProps {
  data: DataRow[];
  columns: ColumnConfig[];
  searchable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  selectable?: boolean;
  exportable?: boolean;
  pagination?: boolean;
  viewModes?: ViewMode[];
  onRowSelect?: (selectedRows: DataRow[]) => void;
  onDataChange?: (filteredData: DataRow[]) => void;
}
