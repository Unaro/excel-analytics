'use client';

import { useCallback } from 'react';
import { useColumnConfigStore } from '@/entities/excelData';
import { useHierarchyStore } from '@/entities/hierarchy';
import { useMetricTemplateStore } from '@/entities/metric';
import { useIndicatorGroupStore } from '@/entities/indicatorGroup';
import { useDashboardStore } from '@/entities/dashboard';
import { toast } from 'sonner';

export function useConfigPersistence() {
  // 1. ЭКСПОРТ
  const exportConfig = useCallback(() => {
    try {
      const config = {
        version: 2, // Версия схемы данных
        timestamp: Date.now(),
        columnConfigs: useColumnConfigStore.getState().configs,
        hierarchyLevels: useHierarchyStore.getState().levels,
        hierarchyConfig: useHierarchyStore.getState().config,
        metricTemplates: useMetricTemplateStore.getState().templates,
        indicatorGroups: useIndicatorGroupStore.getState().groups,
        dashboards: useDashboardStore.getState().dashboards,
      };

      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `urban-analytics-config-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Настройки экспортированы');
    } catch (e) {
      console.error(e);
      toast.error('Ошибка экспорта');
    }
  }, []);

  // 2. ИМПОРТ
  const importConfig = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const config = JSON.parse(text);

      // Простейшая валидация
      if (!config.version || !config.metricTemplates || !config.indicatorGroups) {
        throw new Error('Неверный формат файла');
      }

      if (confirm('Это действие перезапишет текущие настройки (дашборды, группы, шаблоны). Продолжить?')) {
        // Восстанавливаем сторы
        // Порядок важен для зависимостей, но Zustand реактивен, так что не критично
        useColumnConfigStore.getState().setConfigs(config.columnConfigs || []);
        
        useHierarchyStore.getState().setLevels(config.hierarchyLevels || []);
        if(config.hierarchyConfig) useHierarchyStore.getState().updateConfig(config.hierarchyConfig);

        // Важно: сначала очищаем, потом добавляем (или просто перезаписываем через setState, но у нас persist)
        // Zustand persist обычно сам мерджит, но для чистоты лучше использовать методы стора или прямой set
        
        // Для шаблонов нет метода setAll, но persist-хранилище можно обновить хаком или добавить метод setTemplates
        // Давай добавим метод setTemplates в сторы, если его нет, или используем прямой доступ к setState (он доступен в Zustand)
        
        useMetricTemplateStore.setState({ templates: config.metricTemplates });
        useIndicatorGroupStore.setState({ groups: config.indicatorGroups });
        useDashboardStore.setState({ dashboards: config.dashboards });

        toast.success('Настройки успешно импортированы');
        
        // Небольшая задержка и перезагрузка, чтобы сбросить внутренние стейты компонентов
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (e) {
      console.error(e);
      toast.error('Ошибка импорта: ' + (e instanceof Error ? e.message : 'Unknown error'));
    }
  }, []);

  return { exportConfig, importConfig };
}