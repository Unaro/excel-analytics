// widgets/dashboard-view/model/use-dashboard-dataset-sync.ts
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDashboardStore } from '@/entities/dashboard';
import { useDatasetStore } from '@/entities/dataset';
import { refreshPgDataset } from '@/entities/dataset/model/sync-engine';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function useDashboardDatasetSync(dashboardId: string) {
  const router = useRouter();
  const dashboard = useDashboardStore(s => s.getDashboard(dashboardId));
  const dashboardDatasetId = dashboard?.datasetId;
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  const switchDataset = useDatasetStore(s => s.switchDataset);
  const isSyncing = useDatasetStore(s => s.isSyncing);

  const boundDataset = useDatasetStore(
    useCallback(
      (s) => (dashboardDatasetId ? s.datasets[dashboardDatasetId] : null),
      [dashboardDatasetId]
    )
  );

  // Авто-переключение на привязанный датасет
  useEffect(() => {
    if (!dashboard?.datasetId) return;
    if (activeDatasetId === dashboard.datasetId) return;
    switchDataset(dashboard.datasetId);
  }, [dashboard?.datasetId, activeDatasetId, switchDataset]);

  const isPgSource = boundDataset?.sourceType === 'postgres';
  const pgStatus = boundDataset?.pgStatus;
  const [refreshingDataset, setRefreshingDataset] = useState(false);

  const refreshDataset = useCallback(async () => {
    if (!dashboardDatasetId || !isPgSource) return;
    setRefreshingDataset(true);
    try {
      const res = await refreshPgDataset(dashboardDatasetId);
      if (res?.success) {
        router.refresh();
      } else {
        toast.error('Не удалось обновить датасет');
      }
    } catch (err) {
      console.error('[DashboardDatasetSync] Refresh failed:', err);
      toast.error('Ошибка синхронизации');
    } finally {
      setRefreshingDataset(false);
    }
  }, [dashboardDatasetId, isPgSource, router]);

  // ✅ ПРОСТАЯ ЛОГИКА hasData:
  //  - File: данные есть когда Worker готов (engineStatus === 'ready')
  //  - PG: данные есть когда rows загружены
  const hasData = (() => {
    if (!boundDataset) return false;
    if (boundDataset.sourceType === 'file') {
      return boundDataset.engineStatus === 'ready';
    }
    return !!boundDataset.rows && boundDataset.rows.length > 0;
  })();

  return {
    boundDataset,
    hasData,
    isPgSource,
    pgStatus,
    isSyncing,
    refreshingDataset,
    refreshDataset,
  };
}