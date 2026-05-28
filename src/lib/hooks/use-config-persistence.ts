'use client';
import { useCallback } from 'react';
import { useColumnConfigStore } from '@/entities/columnConfig';
import { useHierarchyStore } from '@/entities/hierarchy';
import { useMetricTemplateStore } from '@/entities/metric';
import { useIndicatorGroupStore } from '@/entities/indicatorGroup';
import { useDashboardStore } from '@/entities/dashboard';
import { useDatasetStore } from '@/entities/dataset';
import { createComputationCache } from '@/lib/storage';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { DatasetConfigExport } from '@/entities/exportPackage/types';
import { vmDedupeKey, buildDeterministicVmId } from '@/shared/lib/utils/metric-ids';
import {
  HierarchyFilterValue,
  IndicatorGroup,
  IndicatorGroupInDashboard,
  VirtualMetric,
  VirtualMetricBindingInDashboard,
} from '@/shared/lib/validators';

/**
 * Хук для экспорта/импорта конфигурации датасета.
 */
export function useConfigPersistence() {
  const router = useRouter();

  // ═══════════════════════════════════════════════════════════
  // ЭКСПОРТ
  // ═══════════════════════════════════════════════════════════
  const exportDatasetConfig = useCallback((datasetId: string) => {
    const allDashboards = useDashboardStore.getState().dashboards;
    const allGroups = useIndicatorGroupStore.getState().groups;

    const activeDatasetId = useDatasetStore.getState().activeDatasetId;
    const belongsToDataset = (entityDatasetId: string | undefined) =>
      entityDatasetId === datasetId || (!entityDatasetId && activeDatasetId === datasetId);

    const dashboards = allDashboards
      .filter(d => belongsToDataset(d.datasetId))
      .map(d => ({ ...d, hierarchyFilters: [] as HierarchyFilterValue[] }));

    const indicatorGroups = allGroups.filter(g => belongsToDataset(g.datasetId));

    if (dashboards.length === 0 && indicatorGroups.length === 0) {
      toast.warning('Нечего экспортировать');
      return;
    }

    const payload: DatasetConfigExport = {
      version: 1,
      exportType: 'dataset_config',
      exportedAt: Date.now(),
      sourceDatasetId: datasetId,
      data: {
        dashboards,
        indicatorGroups,
        hierarchyLevels: useHierarchyStore.getState().levelsByDataset[datasetId] || [],
        columnConfigs: useColumnConfigStore.getState().configsByDataset[datasetId] || [],
        metricTemplates: useMetricTemplateStore.getState().templates,
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `config-${datasetId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`Экспортировано: ${dashboards.length} дашбордов, ${indicatorGroups.length} групп`);
  }, []);

  // ═══════════════════════════════════════════════════════════
  // ИМПОРТ
  // ═══════════════════════════════════════════════════════════
  const importToDataset = useCallback(async (file: File, targetDatasetId: string) => {
    try {
      const text = await file.text();
      const raw = JSON.parse(text) as unknown;

      if (typeof raw !== 'object' || raw === null) {
        throw new Error('Неверный формат файла');
      }

      const parsed = raw as Record<string, unknown>;
      if (parsed.exportType !== 'dataset_config') {
        throw new Error('Файл не является конфигом датасета');
      }
      if (parsed.version !== 1) {
        throw new Error(`Неподдерживаемая версия конфига: ${parsed.version}`);
      }

      const config = parsed as unknown as DatasetConfigExport;
      const { data } = config;

      // ───────────────────────────────────────────────────────
      // 1. Metric templates
      // ───────────────────────────────────────────────────────
      const currentTemplates = useMetricTemplateStore.getState().templates;
      const existingTemplateIds = new Set(currentTemplates.map(t => t.id));
      const newTemplates = (data.metricTemplates || []).filter(
        t => !existingTemplateIds.has(t.id)
      );
      if (newTemplates.length > 0) {
        useMetricTemplateStore.setState({
          templates: [...currentTemplates, ...newTemplates],
        });
      }
      const allTemplates = useMetricTemplateStore.getState().templates;

      // ───────────────────────────────────────────────────────
      // 2. Hierarchy levels
      // ───────────────────────────────────────────────────────
      useHierarchyStore
        .getState()
        .setDatasetLevels(targetDatasetId, data.hierarchyLevels || []);

      // ───────────────────────────────────────────────────────
      // 3. Column configs
      // ───────────────────────────────────────────────────────
      useColumnConfigStore
        .getState()
        .setDatasetConfigs(targetDatasetId, data.columnConfigs || []);

      // ───────────────────────────────────────────────────────
      // 4. Indicator groups
      // ───────────────────────────────────────────────────────
      const currentGroups = useIndicatorGroupStore.getState().groups;
      const otherGroups = currentGroups.filter(g => g.datasetId !== targetDatasetId);
      const importedGroups: IndicatorGroup[] = (data.indicatorGroups || []).map(g => ({
        ...g,
        datasetId: targetDatasetId,
      }));
      useIndicatorGroupStore.setState({
        groups: [...otherGroups, ...importedGroups],
      });
      const groupMap = new Map<string, IndicatorGroup>(
        importedGroups.map(g => [g.id, g])
      );

      // ───────────────────────────────────────────────────────
      // 5. Dashboards: ДЕДУПЛИКАЦИЯ виртуальных метрик по смыслу
      // ───────────────────────────────────────────────────────
      const currentDashboards = useDashboardStore.getState().dashboards;
      const otherDashboards = currentDashboards.filter(
        d => d.datasetId !== targetDatasetId
      );

      const importedDashboards = (data.dashboards || []).map(d => {
        // Аккумулятор уникальных VM по ключу дедупликации
        const vmByKey = new Map<string, VirtualMetric>();
        const rebuiltGroupConfigs: IndicatorGroupInDashboard[] = [];

        const dashboardGroupConfigs = d.indicatorGroups || [];

        for (const dgConfig of dashboardGroupConfigs) {
          const group = groupMap.get(dgConfig.groupId);
          if (!group) continue;

          const newBindings: VirtualMetricBindingInDashboard[] = [];

          for (const metric of group.metrics) {
            if (!metric.enabled) continue;

            const template = allTemplates.find(t => t.id === metric.templateId);
            const name = metric.customName && `${metric.customName}(${template?.name})` || metric.customName || template?.name || 'Metric';
            const displayFormat =
              metric.customDisplayFormat || template?.displayFormat || 'number';
            const decimalPlaces =
              metric.customDecimalPlaces ?? template?.decimalPlaces ?? 2;
            const unit = metric.unit || template?.suffix || template?.prefix;

            const semanticKey = `${name}::${displayFormat}::${decimalPlaces}::${unit ?? ''}`;

            if (!vmByKey.has(semanticKey)) {
              vmByKey.set(semanticKey, {
                id: buildDeterministicVmId(semanticKey),
                name,
                displayFormat,
                decimalPlaces,
                order: vmByKey.size,
                unit,
              });
            }

            const vm = vmByKey.get(semanticKey)!;

            newBindings.push({
              virtualMetricId: vm.id,
              metricId: metric.id,
            });
          }

          rebuiltGroupConfigs.push({
            groupId: dgConfig.groupId,
            enabled: dgConfig.enabled,
            order: dgConfig.order,
            virtualMetricBindings: newBindings,
          });
        }

        const rebuiltVirtualMetrics = Array.from(vmByKey.values());

        return {
          ...d,
          datasetId: targetDatasetId,
          virtualMetrics: rebuiltVirtualMetrics,
          indicatorGroups: rebuiltGroupConfigs,
          hierarchyFilters: [] as HierarchyFilterValue[],
        };
      });

      useDashboardStore.setState({
        dashboards: [...otherDashboards, ...importedDashboards],
      });

      // ───────────────────────────────────────────────────────
      // 6. Инвалидация кэша вычислений
      // ───────────────────────────────────────────────────────
      try {
        const fileCache = createComputationCache('file');
        await fileCache.clear(targetDatasetId);
      } catch (err) {
        console.warn('[ConfigImport] File cache invalidation failed:', err);
      }
      try {
        const pgCache = createComputationCache('postgres');
        await pgCache.clear(targetDatasetId);
      } catch (err) {
        console.warn('[ConfigImport] PG cache invalidation failed:', err);
      }

      toast.success(
        `Конфиг применён: ${importedDashboards.length} дашбордов, ` +
          `${importedGroups.length} групп, ${data.hierarchyLevels?.length || 0} уровней`
      );
      router.refresh();
    } catch (e) {
      console.error('[ConfigImport] Error:', e);
      toast.error(e instanceof Error ? e.message : 'Ошибка импорта');
    }
  }, [router]);

  return { exportDatasetConfig, importToDataset };
}