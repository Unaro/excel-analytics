// src/types/sql.ts (новый файл)
export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  createdAt: number;
  lastUsed: number;
  usageCount: number;
}

export interface SavedQueryInput {
  name: string;
  sql: string;
}
