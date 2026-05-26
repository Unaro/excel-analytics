'use client';
import { useCallback } from 'react';
import { useColumnConfigStore } from '@/entities/columnConfig';
import { useHierarchyStore } from '@/entities/hierarchy';
import { useMetricTemplateStore } from '@/entities/metric';
import { useIndicatorGroupStore } from '@/entities/indicatorGroup';
import { useDashboardStore } from '@/entities/dashboard';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { DatasetConfigExport } from '@/entities/exportPackage/types';


export function useConfigPersistence() {
  const router = useRouter();

  const exportDatasetConfig = useCallback((datasetId: string) => {
    const payload: DatasetConfigExport = {
      version: 1,
      exportType: 'dataset_config',
      exportedAt: Date.now(),
      sourceDatasetId: datasetId,
      data: {
        dashboards: useDashboardStore.getState().dashboards.filter(d => d.datasetId === datasetId),
        indicatorGroups: useIndicatorGroupStore.getState().groups.filter(g => g.datasetId === datasetId),
        hierarchyLevels: useHierarchyStore.getState().levelsByDataset[datasetId] || [],
        columnConfigs: useColumnConfigStore.getState().configsByDataset[datasetId] || [],
        metricTemplates: useMetricTemplateStore.getState().templates,
      }
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `config-${datasetId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Конфиг экспортирован');
  }, []);


  const importToDataset = useCallback(async (file: File, targetDatasetId: string) => {
    try {
      const text = await file.text();
      const raw = JSON.parse(text) as unknown;
      
      if (typeof raw !== 'object' || raw === null) throw new Error('Неверный формат');
      const parsed = raw as Record<string, unknown>;
      if (parsed.exportType !== 'dataset_config' || parsed.version !== 1) {
        throw new Error('Файл не является конфигом датасета (v1)');
      }
      const config = parsed as unknown as DatasetConfigExport;
      const { data } = config;


      const currentTemplates = useMetricTemplateStore.getState().templates;
      const mergedTemplates = [...currentTemplates];
      for (const tpl of data.metricTemplates) {
        if (!mergedTemplates.some(t => t.id === tpl.id)) {
          mergedTemplates.push(tpl);
        }
      }
      useMetricTemplateStore.setState({ templates: mergedTemplates });

      useHierarchyStore.getState().setDatasetLevels(targetDatasetId, data.hierarchyLevels);
      useColumnConfigStore.getState().setDatasetConfigs(targetDatasetId, data.columnConfigs);

      const importedGroups = data.indicatorGroups.map(g => ({
        ...g,
        datasetId: targetDatasetId
      }));
      const currentGroups = useIndicatorGroupStore.getState().groups;
      const mergedGroups = [...currentGroups];
      for (const impGroup of importedGroups) {
        const idx = mergedGroups.findIndex(g => g.id === impGroup.id);
        if (idx !== -1) mergedGroups[idx] = impGroup;
        else mergedGroups.push(impGroup);
      }
      useIndicatorGroupStore.setState({ groups: mergedGroups });

      const importedDashboards = data.dashboards.map(d => ({
        ...d,
        datasetId: targetDatasetId
      }));
      const currentDashboards = useDashboardStore.getState().dashboards;
      const mergedDashboards = [...currentDashboards];
      for (const impDash of importedDashboards) {
        const idx = mergedDashboards.findIndex(d => d.id === impDash.id);
        if (idx !== -1) mergedDashboards[idx] = impDash;
        else mergedDashboards.push(impDash);
      }
      useDashboardStore.setState({ dashboards: mergedDashboards });

      toast.success('Конфиг успешно применён к датасету');
      router.refresh();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Ошибка импорта');
    }
  }, [router]);

  return { exportDatasetConfig, importToDataset };
}