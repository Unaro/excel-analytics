/**
 * Zod схемы для валидации данных в Server Actions
 */
import { z } from 'zod';

/**
 * Макс. длина отображаемых имён (группы, шаблоны, метрики, колонки). Имена,
 * приходящие из агрегат-импорта, генерируются из заголовков файла и могут быть
 * длинными (составные «группа · показатель») — потому лимит щедрый, иначе
 * валидный экспорт не проходит обратный импорт.
 */
const NAME_MAX = 255;

// Базовые типы
/** Строка импортированных данных: имя колонки → произвольное значение. */
export const ExcelRowSchema = z.record(z.string(), z.unknown());

/** Выбранное значение уровня иерархии (фильтр дашборда). */
export const HierarchyFilterValueSchema = z.object({
  levelId: z.string().min(1),
  levelIndex: z.number().int().min(0),
  columnName: z.string().min(1),
  value: z.string(),
  displayValue: z.string().optional(),
  operator: z.enum(['exact', '>', '<', '>=', '<=', 'between']).optional(),
  value2: z.string().optional(),
});

/** Условное форматирование (пороги окрашивания) — задаётся на дашборде. */
export const ColorConfigSchema = z.object({
  rules: z.array(z.object({
    id: z.string().min(1),
    operator: z.enum(['>', '>=', '<', '<=', '==', '!=', 'between']),
    value: z.number(),
    value2: z.number().optional(),
    color: z.enum(['emerald', 'rose', 'amber', 'blue', 'indigo', 'slate']),
  })),
});

/**
 * Виртуальная метрика — транзитный носитель для движка и таблиц:
 * имя, формат, decimals и единица заполнены (строит buildVirtualMetric,
 * kpi-compiler, dashboard-columns.buildEffectiveColumn). НЕ хранится
 * на дашборде — хранимая колонка описана DashboardColumnSchema.
 */
export const VirtualMetricSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(NAME_MAX),
  unit: z.string().max(10).optional(),
  displayFormat: z.enum(['number', 'decimal', 'percent', 'percent_raw', 'currency', 'scientific']),
  decimalPlaces: z.number().int().min(0).max(10),
  order: z.number().int(),
  sourceMetricId: z.string().optional(),
  colorConfig: ColorConfigSchema.optional(),
  /** Кросс-столбцовая нормализация — выводится из шаблона (см. MetricTemplate.normalizeBy). */
  normalizeBy: z.enum(['total', 'max', 'min', 'mean']).optional(),
  // Стиль на чарте «Столбцы» (столбец/линия + стиль линии). Прокидывается из
  // group-metric-config в UI-слое, движком вычислений не используется.
  chartStyle: z.object({
    kind: z.enum(['bar', 'line']),
    curve: z.enum(['smooth', 'linear']).optional(),
    dash: z.enum(['solid', 'dashed']).optional(),
  }).optional(),
});

/**
 * Хранимая колонка дашборда = ссылка на шаблон метрики.
 *
 * Формат, имя и единица ВЫВОДЯТСЯ из шаблона (единый источник правды),
 * на колонке хранятся только templateId, пороги окрашивания и порядок.
 * Привязка к метрике каждой группы — автоматическая по шаблону
 * (см. dashboard-columns.ts). Поля формата опциональны: остаются у
 * старых колонок до ленивой миграции, новыми колонками не пишутся.
 */
export const DashboardColumnSchema = z.object({
  id: z.string().min(1),
  templateId: z.string().optional(),
  order: z.number().int(),
  colorConfig: ColorConfigSchema.optional(),
  // legacy (до перехода на колонку-шаблон) — терпим при чтении:
  name: z.string().max(NAME_MAX).optional(),
  unit: z.string().max(10).optional(),
  displayFormat: z.enum(['number', 'decimal', 'percent', 'percent_raw', 'currency', 'scientific']).optional(),
  decimalPlaces: z.number().int().min(0).max(10).optional(),
  sourceMetricId: z.string().optional(),
});

/** Привязка алиаса формулы к колонке датасета. */
export const FieldBindingSchema = z.object({
  id: z.string().min(1),
  fieldAlias: z.string().min(1),
  columnName: z.string().min(1),
  description: z.string().optional(),
});

/** Привязка алиаса формулы к другой метрике группы. */
export const MetricBindingSchema = z.object({
  id: z.string().min(1),
  metricAlias: z.string().min(1),
  metricId: z.string().min(1),
  description: z.string().optional(),
});

/** Метрика внутри группы показателей (инстанс шаблона с привязками). */
export const GroupMetricSchema = z.object({
  id: z.string().min(1),
  templateId: z.string().min(1),
  fieldBindings: z.array(FieldBindingSchema),
  metricBindings: z.array(MetricBindingSchema),
  enabled: z.boolean(),
  order: z.number().int(),
  customName: z.string().optional(),
  /**
   * Опциональный override единицы измерения поверх шаблонной (template.unit).
   * Формат и знаки после запятой берутся строго из шаблона — отдельный
   * формат на метрике не нужен (для другого формата заведите свой шаблон).
   */
  unit: z.string().optional(),
});

/**
 * Шаблон метрики — всегда формула (агрегаты задаются функциями: SUM(a)).
 * Прежний тип `aggregate` упразднён: «сумма поля» = формула `SUM(field)`.
 */
export const MetricTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(NAME_MAX),
  description: z.string().optional(),
  formula: z.string().min(1),
  dependencies: z.array(z.object({
    type: z.enum(['field', 'metric']),
    alias: z.string().min(1),
    description: z.string().optional(),
  })),
  displayFormat: z.enum(['number', 'decimal', 'percent', 'percent_raw', 'currency', 'scientific']),
  decimalPlaces: z.number().int().min(0).max(10),
  /**
   * Единица измерения — источник правды формата метрики. Наследуется
   * всеми группами и колонками дашборда; на метрике группы может быть
   * переопределена (GroupMetric.unit).
   */
  unit: z.string().optional(),
  /**
   * Условное форматирование — единый источник правды на шаблоне. Любая
   * колонка дашборда / метрика группы с этим templateId наследует правила;
   * редактирование в дашборде и в /groups/[id] меняет одни и те же правила.
   */
  colorConfig: ColorConfigSchema.optional(),
  /**
   * Кросс-столбцовая нормализация (пост-обработка результата): значение каждой
   * строки делится на ориентир по столбцу текущего представления (итог/макс/
   * мин/среднее). Нет = «как есть». Показ процентом делает displayFormat —
   * «% от итога» = normalizeBy:'total' + percent. Знаменатель считается на
   * рендере по столбцу конкретного вида (разбивка группы / строки дашборда),
   * нигде не хранится.
   */
  normalizeBy: z.enum(['total', 'max', 'min', 'mean']).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

/** Группа показателей: набор метрик над полями датасета. */
export const IndicatorGroupSchema = z.object({
  id: z.string().min(1),
  datasetId: z.string().optional(),
  name: z.string().min(1).max(NAME_MAX),
  description: z.string().optional(),
  fieldMappings: z.array(FieldBindingSchema),
  metrics: z.array(GroupMetricSchema),
  /**
   * Поисковый запрос «Контекст данных» из конструктора группы — фильтр
   * колонок при привязке. Сохраняется, чтобы при редактировании группы
   * пользователю не пришлось вводить его заново.
   */
  columnContext: z.string().optional(),
  dependencyGraph: z.object({
    nodes: z.array(z.string()),
    edges: z.array(z.object({
      from: z.string(),
      to: z.string(),
    })),
  }).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  /** Палитра цветов серий чартов группы (id из CHART_PALETTES). Нет/'default' = текущие дефолты. */
  paletteId: z.string().optional(),
  /**
   * Условия отображения элементов уровня (как условное форматирование, но для
   * видимости): строка разбивки показывается, если её метрики удовлетворяют ВСЕМ
   * правилам (AND). Применяется к таблице и чартам. Нет правил → показываем всё.
   */
  displayFilters: z.array(z.object({
    id: z.string(),
    metricId: z.string(),
    operator: z.enum(['>', '>=', '<', '<=', '==', '!=', 'between']),
    value: z.number(),
    value2: z.number().optional(),
    /**
     * Сравнение «метрика vs метрика» в одной строке: если задано, правая часть
     * берётся из этой метрики строки (а не из `value`/`value2`). Напр.
     * «Итоговое ≠ Потребность». Сравнение — с допуском по float.
     */
    compareMetricId: z.string().optional(),
  })).optional(),
  order: z.number().int(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

// 1. Выносим привязку в отдельную схему
/** Связь виртуальной метрики дашборда с метрикой группы. */
export const VirtualMetricBindingInDashboardSchema = z.object({
  virtualMetricId: z.string().min(1),
  metricId: z.string().min(1),
});

// 2. Используем её внутри конфигурации группы
/** Конфигурация группы показателей на конкретном дашборде. */
export const IndicatorGroupInDashboardSchema = z.object({
  groupId: z.string().min(1),
  enabled: z.boolean(),
  order: z.number().int(),
  virtualMetricBindings: z.array(VirtualMetricBindingInDashboardSchema).optional(),
});

// 3. Экспортируем типы
export type VirtualMetricBindingInDashboard = z.infer<typeof VirtualMetricBindingInDashboardSchema>;
export type IndicatorGroupInDashboard = z.infer<typeof IndicatorGroupInDashboardSchema>;

// Схема для параметров вычисления
/** Параметры серверного вычисления метрик (legacy-путь по сырым строкам). */
export const ComputeParamsSchema = z.object({
  dashboardId: z.string().min(1).max(64),
  
  data: z.array(ExcelRowSchema)
    .min(0)
    .max(100000),
  
  allGroups: z.array(IndicatorGroupSchema)
    .max(100),
  
  dashboardGroupsConfig: z.array(IndicatorGroupInDashboardSchema)
    .max(100),
  
  metricTemplates: z.array(MetricTemplateSchema)
    .max(500),
  
  virtualMetrics: z.array(VirtualMetricSchema)
    .max(50),
  
  filters: z.array(HierarchyFilterValueSchema)
    .max(10),
});

export type ComputeParams = z.infer<typeof ComputeParamsSchema>;
export type ExcelRow = z.infer<typeof ExcelRowSchema>;
export type HierarchyFilterValue = z.infer<typeof HierarchyFilterValueSchema>;
export type VirtualMetric = z.infer<typeof VirtualMetricSchema>;
export type DashboardColumn = z.infer<typeof DashboardColumnSchema>;
export type IndicatorGroup = z.infer<typeof IndicatorGroupSchema>;
export type DisplayFilterRule = NonNullable<IndicatorGroup['displayFilters']>[number];
export type MetricTemplate = z.infer<typeof MetricTemplateSchema>;
export type GroupMetric = z.infer<typeof GroupMetricSchema>;

export type FieldBinding = z.infer<typeof FieldBindingSchema>;
export type MetricBinding = z.infer<typeof MetricBindingSchema>;


/**
 * Строгая Zod-схема для валидации JSON-файла конфигурации датасета.
 *
 * Используется в features/config-persistence вместо `as unknown as`.
 * Даёт чёткие ошибки валидации при импорте повреждённых конфигов.
 */
export const DatasetConfigExportSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  exportType: z.literal('dataset_config'),
  exportedAt: z.number(),
  sourceDatasetId: z.string(),
  data: z.object({
    dashboards: z.array(z.unknown()), // Dashboard — сложная схема, оставим unknown
    indicatorGroups: z.array(IndicatorGroupSchema),
    hierarchyLevels: z.array(z.object({
      id: z.string(),
      columnName: z.string(),
      displayName: z.string(),
      order: z.number(),
    })),
    columnConfigs: z.array(z.object({
      columnName: z.string(),
      classification: z.enum(['numeric', 'categorical', 'ignore', 'date']),
      alias: z.string(),
      displayName: z.string(),
      description: z.string().optional(),
      // Пользовательский тип со справочником: переносится как ссылка,
      // сам справочник в экспорт-пакет не входит
      customTypeId: z.string().optional(),
    })),
    metricTemplates: z.array(MetricTemplateSchema),
    // Разметка агрегата датасета (для замены файла по тем же настройкам).
    aggregateConfig: z
      .object({
        headerRows: z.number().int(),
        keyColumns: z.array(z.number().int()),
        empty: z.object({ tokens: z.array(z.string()).optional() }).optional(),
        totalKeywords: z.array(z.string()).optional(),
        excludeGroups: z.array(z.string()).optional(),
        metricTemplateNames: z.record(z.string(), z.string()).optional(),
        importUnassignedMetrics: z.boolean().optional(),
        metricTemplateSpecs: z
          .array(
            z.object({
              name: z.string(),
              formula: z.string(),
              alias: z.string(),
              displayFormat: z.string(),
              decimalPlaces: z.number(),
              unit: z.string().optional(),
              normalizeBy: z.string().optional(),
              serviceOnly: z.boolean().optional(),
            })
          )
          .optional(),
        calculatedTemplateSpecs: z
          .array(
            z.object({
              name: z.string(),
              formula: z.string(),
              operands: z.array(
                z.object({ alias: z.string(), indicatorName: z.string() })
              ),
              displayFormat: z.string(),
              decimalPlaces: z.number(),
              unit: z.string().optional(),
              normalizeBy: z.string().optional(),
            })
          )
          .optional(),
      })
      .optional(),
    groupMetricConfigs: z.record(
      z.string(),
      z.record(z.string(), z.object({
        colorConfig: z.object({
          rules: z.array(z.object({
            id: z.string(),
            operator: z.enum(['>', '>=', '<', '<=', '==', '!=', 'between']),
            value: z.number(),
            value2: z.number().optional(),
            color: z.enum(['emerald', 'rose', 'amber', 'blue', 'indigo', 'slate']),
          })),
        }).optional(),
      }))
    ).optional(),
  }),
});

export type DatasetConfigExportParsed = z.infer<typeof DatasetConfigExportSchema>;