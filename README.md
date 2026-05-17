# Urban Analytics Platform

> **Версия:** 0.2.0 | **Архитектура:** FSD-подобная | **State:** Zustand + Next.js Server Actions

Платформа для анализа градостроительных и бизнес-данных с поддержкой **Excel/CSV** и **PostgreSQL**. Позволяет настраивать иерархические фильтры, создавать расчётные метрики, объединять их в группы показателей и визуализировать результаты на интерактивных дашбордах.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0+-61dafb?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)

## Ключевые возможности
- **Мульти-источники данных**: Загрузка Excel/CSV файлов или прямое подключение к PostgreSQL с предпросмотром схем и таблиц.
- **Безопасное хранение**: Конфигурации подключения к БД шифруются на клиенте (`AES-GCM` через Web Crypto API) перед сохранением.
- **Конструктор иерархии**: Drag-and-drop настройка уровней вложенности (`Регион → Город → Район`) с авто-фильтрацией данных по выбранному пути.
- **Библиотека шаблонов**: Создание абстрактных правил агрегации и **визуальный конструктор формул** (перетаскивание токенов, валидация AST).
- **Группы показателей**: Привязка шаблонов к реальным колонкам датасета с поддержкой меж-метрических зависимостей и кастомных названий.
- **Дашборды**: Матричные таблицы, графики (`Bar`/`Radar`), KPI-виджеты с каскадными расчётами и условное форматирование с настраиваемыми правилами.
- **Адаптивный UI**: Полная поддержка тёмной темы (`next-themes`), мобильная навигация, кастомные скроллбары, анимации переходов.

## Технический стек
| Категория | Технологии |
|---|---|
| **Framework** | Next.js 16+ (App Router, Server Actions, RSC) |
| **Language** | TypeScript 5.x, Strict Mode |
| **State & Storage** | Zustand 5.x + `persist` (IndexedDB для данных, LocalStorage для конфигов) |
| **Styling & UI** | TailwindCSS v4, Radix UI Primitives, Lucide Icons, Sonner (toasts) |
| **DnD & Charts** | `@dnd-kit/core`, Recharts 2.x |
| **Math & Validation** | Math.js 15.x (AST-парсинг), Zod 4.x (Server Actions) |
| **Integrations** | `xlsx` (парсинг), `postgres` (SQL-клиент), Web Crypto API |

## Установка и запуск
```bash
# 1. Клонирование репозитория
git clone <repository-url>
cd <project-folder>

# 2. Установка зависимостей
npm install

# 3. Запуск сервера разработки (Turbopack)
npm run dev
```
Приложение откроется на [http://localhost:3000](http://localhost:3000)

## Работа с проектом

### 1. Загрузка данных (`/setup`)
- Перейдите в раздел **«Данные и Структура»**.
- Выберите источник: `Excel / CSV` или `PostgreSQL`.
- При подключении к PostgreSQL данные схемы запрашиваются через Server Actions, а строки ограничены лимитом `50 000` для стабильности.
- Настройте типы колонок:
  - **Число** → для агрегаций и формул.
  - **Категория** → для фильтрации и иерархии.
  - **Дата** → для временных фильтров.
  - **Скрыто** → исключение из расчётов.

### 2. Настройка иерархии (`/hierarchy`)
- Добавьте категориальные колонки в структуру дерева.
- Перетаскивайте уровни для изменения порядка вложенности.
- Иерархия привязывается к активному датасету и используется для каскадной фильтрации на всех дашбордах.

### 3. Создание метрик (`/metrics` или `/config`)
- Создайте **абстрактный шаблон** расчёта:
  - **Агрегация**: `SUM`, `AVG`, `COUNT`, `MIN`, `MAX`, `MEDIAN`.
  - **Формула**: Используйте визуальный конструктор для сборки выражений вида `(a + b) / c * 100`.
- Шаблоны не привязаны к конкретным файлам, что позволяет переиспользовать логику.

### 4. Группы показателей (`/groups`)
- Создайте группу (например, `«Школы»` или `«Дошкольные учреждения»`).
- Добавьте метрики из шаблонов.
- Привяжите переменные формулы к реальным колонкам Excel или другим метрикам внутри группы.
- Поддерживаются кастомные названия и единицы измерения для каждой метрики.

### 5. Дашборд (`/dashboards`)
- Создайте новый дашборд и выберите привязанный датасет.
- Добавьте **виртуальные колонки** (показатели дашборда).
- Подключите группы показателей и настройте матрицу привязок (какая группа считает какую виртуальную колонку).
- Добавьте **KPI-виджеты** (поддерживают зависимости друг от друга).
- Настройте **условное форматирование** прямо в ячейках таблицы (правила применяются сверху вниз).
- Используйте левый сайдбар с деревом иерархии для мгновенной фильтрации и пересчёта.

## Структура проекта
Проект использует плоскую структуру без папки `src/`, соответствующую Feature-Sliced Design (FSD):
```
app/                    # Next.js App Router & Server Actions
├── actions/            # compute.ts, parse.ts, postgres.ts (валидация через Zod)
├── dashboards/         # Просмотр, редактирование и создание дашбордов
├── groups/             # Профили и конструктор групп показателей
├── hierarchy/          # Конструктор уровней иерархии
├── metrics/            # Управление шаблонами метрик
├── setup/              # Менеджер датасетов и настройка колонок
├── settings/           # Экспорт/импорт JSON, полный сброс системы
└── providers/          # ThemeProvider, ClientLayout (Sidebar, MobileNav)
│
entities/               # Бизнес-сущности и Zustand-сторы
├── columnConfig/       # Конфигурация типов колонок
├── dashboard/          # Дашборды, виджеты, KPI, виртуальные метрики
├── dataset/            # Датасеты, синхронизация, IndexedDB-хранилище
├── formula/            # Типы формул и валидации
├── hierarchy/          # Уровни и фильтры иерархии
├── indicatorGroup/     # Группы показателей и привязки полей
└── metric/             # Шаблоны метрик, кэш вычислений, типы агрегаций
│
features/               # Функциональные компоненты
├── AddKpiWidget/       # Диалог добавления KPI
├── BuildFormula/       # Визуальный drag-and-drop конструктор формул
├── ConfigureTableMetric/ # Попап условного форматирования
├── CreateMetricTemplate/ # Создание шаблонов метрик
├── DatasetSourceSelector/ # Переключатель Excel/PG
├── PostgresConnection/ # Форма подключения и браузер таблиц
├── SwitchDataset/      # Дропдаун переключения активного датасета
├── ThemeToggle/        # Переключатель светлой/тёмной темы
└── UploadExcel/        # Загрузчик файлов с drag-and-drop
│
widgets/                # Композиции страниц
├── ChartsSection/      # Графики (Bar/Radar) с мемоизацией
├── DashboardBuilder/   # Матрица привязки групп к колонкам
├── GroupBuilder/       # Конструктор метрик внутри группы
├── HierarchyFilter/    # Древовидный фильтр с ленивой загрузкой
├── KpiGrid/            # Сетка KPI-карточек
├── MobileNav/          # Мобильная навигация
├── Sidebar/            # Десктопное меню
└── TemplateManager/    # Список шаблонов метрик
│
lib/                    # Общая логика и хуки
├── hooks/              # Кастомные хуки (расчёты, гидратация, фильтры)
└── logic/              # safe-math.ts, validators.ts, postgres-client.ts, crypto.ts
│
shared/                 # Переиспользуемый код
├── lib/                # Утилиты (translit, format, cn, crypto)
└── ui/                 # Примитивы (Button, Card, Dialog, Input, Select)
│
types/                  # Единая точка входа для TypeScript-типов
```

## Безопасность и Хранение данных

### Server Actions & Валидация
- Все серверные вызовы (`compute`, `parse`, `postgres`) валидируют входные данные через **Zod**.
- Ограничения: до `100 000` строк, до `100` групп, до `1000` символов в формуле.
- Соединения с PostgreSQL гарантированно закрываются через `try/finally`.

### Безопасная математика
- Перед вычислением формулы выполняется **AST-анализ** (`mathjs`).
- Разрешены только безопасные функции: `SUM`, `AVG`, `MAX`, `MIN`, `ROUND`, `ABS`, арифметика.
- Блокируются `require`, `eval`, `process`, `window`, `__proto__`.

### Хранение состояния
| Стор | Движок | Назначение |
|---|---|---|
| `useDatasetStore` | **IndexedDB** (`idb-keyval`) | Сырые строки данных (до 50k), метаданные, зашифрованные PG-конфиги |
| `useDashboardStore` | LocalStorage | Конфигурации дашбордов, виджеты, KPI, виртуальные метрики |
| `useIndicatorGroupStore` | LocalStorage | Группы показателей, привязки полей и метрик |
| `useMetricTemplateStore` | LocalStorage | Библиотека шаблонов агрегации и формул |
| `useHierarchyStore` | LocalStorage | Уровни иерархии, привязанные к датасетам |
| `useColumnConfigStore` | LocalStorage | Настройки типов и алиасов колонок |

> ⚠️ При превышении квоты IndexedDB система автоматически обрезает массивы строк до безопасного лимита, сохраняя метаданные.

## Скрипты
```bash
npm run dev          # Разработка с Turbopack
npm run build        # Production-сборка
npm run start        # Запуск production-сервера
npm run type-check   # Проверка типов TypeScript
npm run lint         # Линтинг кода
```

## Docker (опционально)
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["npm", "start"]
```

## 📝 Лицензия
Проект распространяется под лицензией MIT. Разработан для внутреннего и образовательного использования.

## 📞 Контакты & Ресурсы
- 🌐 **Demo**: [excel-analytics-teal.vercel.app](https://excel-analytics-teal.vercel.app)
- 🐙 **GitHub**: [github.com/Unaro/excel-analytics](https://github.com/Unaro/excel-analytics)
