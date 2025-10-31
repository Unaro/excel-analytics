// src/app/settings/danger/page.tsx (полная версия с новым API)
'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Trash2, Database, RotateCcw, Zap, BarChart3, Settings } from 'lucide-react';
import { 
  clearUploadedData, 
  clearAnalyticsGroups, 
  clearIndicatorsLibrary,
  clearDashboardsData,
  clearHierarchyConfig, 
  clearFieldTypesData, 
  clearAllData,
  getDataStatus 
} from '@/lib/cleanup';
import { 
  formatDataStatusWithUnits, 
  formatDataStatus,
  safeParse 
} from '@/lib/utils';

type DangerLevel = 'high' | 'critical';

interface StorageItem {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  getValue: () => string;
  onDelete: () => void;
  danger: DangerLevel;
}

export default function SettingsDangerPage() {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [dataStatus, setDataStatus] = useState<ReturnType<typeof getDataStatus>>({
    excelAnalyticsData: null,
    analyticsGroups: null,
    indicatorLibrary: null,
    dashboards: null,
    hierarchyConfig: null,
    fieldTypes: null,
  });

  const reloadDataStatus = useCallback(() => {
    if (typeof window === 'undefined') return;
    setDataStatus(getDataStatus());
  }, []);

  useEffect(() => {
    setIsMounted(true);
    reloadDataStatus();

    const onStorage = () => reloadDataStatus();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [reloadDataStatus]);

  // Обработчики удаления с перезагрузкой статуса
  const handleClearUploadedData = useCallback(() => {
    clearUploadedData();
    reloadDataStatus();
  }, [reloadDataStatus]);

  const handleClearGroups = useCallback(() => {
    clearAnalyticsGroups();
    reloadDataStatus();
  }, [reloadDataStatus]);

  const handleClearIndicators = useCallback(() => {
    clearIndicatorsLibrary();
    reloadDataStatus();
  }, [reloadDataStatus]);

  const handleClearDashboards = useCallback(() => {
    clearDashboardsData();
    reloadDataStatus();
  }, [reloadDataStatus]);

  const handleClearHierarchy = useCallback(() => {
    clearHierarchyConfig();
    reloadDataStatus();
  }, [reloadDataStatus]);

  const handleClearFieldTypes = useCallback(() => {
    clearFieldTypesData();
    reloadDataStatus();
  }, [reloadDataStatus]);

  const handleClearAll = useCallback(() => {
    const msg =
      '⚠️ КРИТИЧЕСКОЕ ДЕЙСТВИЕ!\n\n' +
      'Будут удалены ВСЕ данные приложения:\n' +
      '• Загруженные Excel/CSV файлы\n' +
      '• Группы показателей\n' +
      '• Библиотека индикаторов\n' +
      '• Созданные дашборды\n' +
      '• Настройки иерархии\n' +
      '• Типы полей\n\n' +
      'Для подтверждения введите: УДАЛИТЬ ВСЁ';

    const input = window.prompt(msg);
    if (input !== 'УДАЛИТЬ ВСЁ') return;

    clearAllData();
    setDeleted('all');
    setConfirmDelete(null);
    reloadDataStatus();

    setTimeout(() => {
      window.location.href = '/';
    }, 1500);
  }, [reloadDataStatus]);

  if (!isMounted) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
        <span className="ml-3 text-gray-600">Загрузка настроек...</span>
      </div>
    );
  }

  const items: StorageItem[] = [
    {
      key: 'excelAnalyticsData',
      label: 'Данные Excel/CSV',
      description: 'Удаляет все загруженные файлы, таблицы и кэш обработанных данных',
      icon: <Database className="w-5 h-5" />,
      getValue: () => formatDataStatusWithUnits(
        safeParse(dataStatus.excelAnalyticsData), 
        ['файл', 'файла', 'файлов']
      ),
      onDelete: handleClearUploadedData,
      danger: 'critical',
    },
    {
      key: 'analyticsGroups',
      label: 'Группы показателей',
      description: 'Удаляет все созданные группы с фильтрами, формулами и настройками',
      icon: <Zap className="w-5 h-5" />,
      getValue: () => formatDataStatusWithUnits(
        safeParse(dataStatus.analyticsGroups), 
        ['группа', 'группы', 'групп']
      ),
      onDelete: handleClearGroups,
      danger: 'high',
    },
    {
      key: 'indicatorLibrary',
      label: 'Библиотека индикаторов',
      description: 'Удаляет все сохраненные пользовательские показатели и формулы',
      icon: <Settings className="w-5 h-5" />,
      getValue: () => formatDataStatusWithUnits(
        safeParse(dataStatus.indicatorLibrary), 
        ['индикатор', 'индикатора', 'индикаторов']
      ),
      onDelete: handleClearIndicators,
      danger: 'high',
    },
    {
      key: 'dashboards',
      label: 'Дашборды',
      description: 'Удаляет все созданные дашборды, их конфигурации и виджеты',
      icon: <BarChart3 className="w-5 h-5" />,
      getValue: () => formatDataStatusWithUnits(
        safeParse(dataStatus.dashboards), 
        ['дашборд', 'дашборда', 'дашбордов']
      ),
      onDelete: handleClearDashboards,
      danger: 'high',
    },
    {
      key: 'hierarchyConfig',
      label: 'Конфигурация иерархии',
      description: 'Удаляет структуру уровней фильтрации и их порядок',
      icon: <RotateCcw className="w-5 h-5" />,
      getValue: () => formatDataStatusWithUnits(
        safeParse(dataStatus.hierarchyConfig), 
        ['уровень', 'уровня', 'уровней']
      ),
      onDelete: handleClearHierarchy,
      danger: 'high',
    },
    {
      key: 'fieldTypes',
      label: 'Типы полей',
      description: 'Сбрасывает пользовательские типы колонок (будут определены автоматически)',
      icon: <Database className="w-5 h-5" />,
      getValue: () => formatDataStatus(dataStatus.fieldTypes, 'По умолчанию'),
      onDelete: handleClearFieldTypes,
      danger: 'high',
    },
  ];

  const handleDelete = (item: StorageItem) => {
    item.onDelete();
    setDeleted(item.key);
    setConfirmDelete(null);
    setTimeout(() => setDeleted(null), 3000);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Главное предупреждение */}
      <div className="rounded-xl border-2 border-red-300 bg-red-50 p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-xl font-bold text-red-900 mb-2">⚠️ Опасная зона</h2>
            <p className="text-red-800 leading-relaxed">
              Все действия в этом разделе <strong>необратимы</strong>. 
              Рекомендуется экспортировать важные данные перед удалением.
            </p>
          </div>
        </div>
      </div>

      {/* Уведомление об успешном удалении */}
      {deleted && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-600"></div>
            <span className="text-green-800 font-medium">
              {deleted === 'all' ? 
                '🗑️ Все данные успешно удалены. Перенаправление...' : 
                '✓ Данные успешно удалены'
              }
            </span>
          </div>
        </div>
      )}

      {/* Список элементов для удаления */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">Управление данными</h3>
        
        {items.map((item) => (
          <div
            key={item.key}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div
                  className={`
                    p-3 rounded-lg flex-shrink-0 transition-colors
                    ${item.danger === 'critical' 
                      ? 'bg-red-100 text-red-600' 
                      : 'bg-orange-100 text-orange-600'
                    }
                  `}
                >
                  {item.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-gray-900">{item.label}</h4>
                    <span
                      className={`
                        px-2 py-1 text-xs font-medium rounded-full
                        ${item.danger === 'critical' 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-orange-100 text-orange-700'
                        }
                      `}
                    >
                      {item.danger === 'critical' ? 'Критично' : 'Высокий риск'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3 leading-relaxed">{item.description}</p>
                  <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-md inline-block">
                    <strong>Статус:</strong> {item.getValue()}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setConfirmDelete(item.key)}
                className={`
                  flex-shrink-0 px-4 py-2 text-white rounded-lg transition-all duration-200 
                  flex items-center gap-2 font-medium hover:scale-105 active:scale-95
                  ${item.danger === 'critical' 
                    ? 'bg-red-600 hover:bg-red-700 shadow-red-200' 
                    : 'bg-orange-600 hover:bg-orange-700 shadow-orange-200'
                  } shadow-lg
                `}
              >
                <Trash2 className="w-4 h-4" />
                Удалить
              </button>
            </div>

            {/* Подтверждение удаления */}
            {confirmDelete === item.key && (
              <div className="mt-6 pt-4 border-t border-gray-200 animate-fade-in">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-yellow-900 mb-1">
                    ⚠️ Подтверждение удаления
                  </p>
                  <p className="text-sm text-yellow-800">
                    Это действие необратимо. Данные будут удалены навсегда.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDelete(item)}
                    className="px-5 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Да, удалить
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="px-5 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Полная очистка */}
      <div className="rounded-xl border-2 border-red-500 bg-red-50 p-6 shadow-lg">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-7 h-7 text-red-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-bold text-red-900 mb-3">🚨 Полная очистка приложения</h3>
            <div className="text-sm text-red-800 mb-4 space-y-2">
              <p>Это действие удалит <strong>ВСЕ</strong> данные из локального хранилища:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Загруженные Excel/CSV файлы</li>
                <li>Созданные группы показателей</li>
                <li>Библиотеку пользовательских индикаторов</li>
                <li>Все дашборды и их настройки</li>
                <li>Конфигурацию иерархии фильтрации</li>
                <li>Типы полей и прочие настройки</li>
              </ul>
              <p className="font-medium">После очистки вы будете перенаправлены на главную страницу.</p>
            </div>
            <button
              onClick={handleClearAll}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 font-bold flex items-center gap-2 hover:scale-105 active:scale-95 shadow-lg"
            >
              <AlertTriangle className="w-5 h-5" />
              Очистить всё
            </button>
          </div>
        </div>
      </div>

      {/* Полезная информация */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
        <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
          💡 Рекомендации
        </h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p>• Экспортируйте важные группы показателей и индикаторы перед удалением</p>
          <p>• Сделайте скриншоты дашбордов, если они содержат важную аналитику</p>
          <p>• Типы полей будут автоматически определены при повторной загрузке данных</p>
          <p>• После полной очистки приложение вернется к первоначальному состоянию</p>
        </div>
      </div>
    </div>
  );
}
