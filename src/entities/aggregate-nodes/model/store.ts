// entities/aggregate-nodes/model/store.ts
// ─────────────────────────────────────────────────────────────
// Введённые/предпосчитанные значения узлов файла-агрегата (мега-босс, фаза 2).
//
// Хранит по datasetId список узлов (промежуточные уровни + «Итого») с их
// введёнными значениями метрик. Движок считает листья; этот стор — overlay
// «введённое vs вычисленное» для UI. План: docs/architecture/aggregate-files.md
// ─────────────────────────────────────────────────────────────
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type AggregateNode, nodePathKey } from '@/shared/lib/types/aggregate';

interface AggregateNodesState {
  /** nodesByDataset[datasetId] = узлы агрегата. */
  nodesByDataset: Record<string, AggregateNode[]>;
  setNodes: (datasetId: string, nodes: AggregateNode[]) => void;
  getNodes: (datasetId: string) => AggregateNode[];
  /** Словарь путь→значения метрик для быстрого lookup в UI. */
  getNodeMap: (datasetId: string) => Map<string, Record<string, number | null>>;
  clearNodes: (datasetId: string) => void;
}

export const useAggregateNodesStore = create<AggregateNodesState>()(
  persist(
    (set, get) => ({
      nodesByDataset: {},

      setNodes: (datasetId, nodes) =>
        set((state) => ({
          nodesByDataset: { ...state.nodesByDataset, [datasetId]: nodes },
        })),

      getNodes: (datasetId) => get().nodesByDataset[datasetId] ?? [],

      getNodeMap: (datasetId) => {
        const map = new Map<string, Record<string, number | null>>();
        for (const node of get().nodesByDataset[datasetId] ?? []) {
          map.set(nodePathKey(node.path), node.values);
        }
        return map;
      },

      clearNodes: (datasetId) =>
        set((state) => {
          if (!state.nodesByDataset[datasetId]) return state;
          const next = { ...state.nodesByDataset };
          delete next[datasetId];
          return { nodesByDataset: next };
        }),
    }),
    { name: 'aggregate-nodes-storage', version: 1 }
  )
);
