// ─────────────────────────────────────────────────────────────
// Разметка файла-агрегата (мега-босс, фаза 0).
//
// Чистая логика детекта структуры по матрице превью: каскад ключевых колонок
// (иерархия кодируется глубиной заполненного ключа), классификация строк
// (лист / промежуточный узел / «Итого»), составные имена из multi-row шапки,
// предпросмотр групп и дерева иерархии.
//
// Движок и импорт НЕ трогаются — это только парсинг + модель разметки.
// Детект — best-effort предложение; пользователь подтверждает на шаге «Структура».
// План: docs/architecture/aggregate-files.md
// ─────────────────────────────────────────────────────────────

/** Роль колонки в агрегате. */
export type ColumnRole = 'key' | 'metric' | 'attribute';
/** Тип строки данных. */
export type RowKind = 'leaf' | 'node' | 'total';

export interface AggregateColumn {
  index: number;
  /** Верхний заголовок (из групповой строки шапки); '' — нет. */
  groupName: string;
  /** Имя из нижней строки шапки. */
  name: string;
  /** Составное имя: «группа · имя» либо просто имя. */
  fullName: string;
  role: ColumnRole;
}

export interface ClassifiedRow {
  cells: string[];
  /** Глубина = порядковый индекс самого правого заполненного ключа (0-based).
   *  -1 — ни один ключ не заполнен. */
  level: number;
  kind: RowKind;
  /** Метка самого глубокого заполненного ключа (для total — текст метки). */
  label: string;
}

/** Настройка трактовки пустоты (0 — НЕ пустота по умолчанию). */
export interface EmptyConfig {
  /** Доп. значения, считающиеся пустотой («—», «н/д», …). Регистр игнорируется. */
  tokens?: string[];
}

const DEFAULT_TOTAL_KEYWORDS = ['итого', 'всего', 'total'];
// Число с десятичной запятой/точкой и пробелами-тысячами (как в превью).
const NUMBER_RE = /^-?\d+(?:[.,]\d+)?$/;
// «Код»: двоеточия/слеши (8:01:06) или ведущий ноль у многозначного (007).
const CODE_RE = /[:/]|^0\d/;

/** Пустая ли ячейка с учётом настройки. `0` пустотой НЕ считается. */
export function isEmptyCell(value: string | null | undefined, cfg?: EmptyConfig): boolean {
  if (value == null) return true;
  const s = String(value).trim();
  if (s === '') return true;
  if (cfg?.tokens?.length) {
    const lower = s.toLowerCase();
    if (cfg.tokens.some(t => t.trim().toLowerCase() === lower)) return true;
  }
  return false;
}

/** Похоже ли значение на код (ключ), а не на число-метрику. */
function isCodeLike(s: string): boolean {
  return CODE_RE.test(s);
}

/** Доля «чисто числовых» (не кодовых) значений в колонке. */
function metricScore(values: string[], cfg?: EmptyConfig): number {
  const nonEmpty = values.filter(v => !isEmptyCell(v, cfg));
  if (nonEmpty.length === 0) return 0;
  let numeric = 0;
  for (const v of nonEmpty) {
    const s = v.trim();
    if (isCodeLike(s)) continue;
    const norm = s.replace(/\s/g, '').replace(',', '.');
    if (NUMBER_RE.test(norm)) numeric++;
  }
  return numeric / nonEmpty.length;
}

/** Колонка — числовая метрика (а не ключ/атрибут)? */
export function isMetricColumn(values: string[], cfg?: EmptyConfig): boolean {
  return metricScore(values, cfg) > 0.6;
}

/** Число непустых ячеек в строке. */
function filledCount(row: string[], cfg?: EmptyConfig): number {
  return row.reduce((n, c) => (isEmptyCell(c, cfg) ? n : n + 1), 0);
}

/**
 * Сколько верхних строк матрицы — шапка. Эвристика: групповая строка
 * (multi-row, объединённые ячейки) заметно разреженнее строки имён под ней.
 * Возвращает 2, если первая строка существенно «пустее» второй, иначе 1.
 * Пользователь правит на шаге «Структура».
 */
export function detectHeaderRows(matrix: string[][], cfg?: EmptyConfig): number {
  if (matrix.length < 3) return 1;
  const f0 = filledCount(matrix[0], cfg);
  const f1 = filledCount(matrix[1], cfg);
  // row1 должна быть «плотной» (имена колонок), row0 — разреженной (группы).
  if (f1 >= 3 && f0 > 0 && f0 <= f1 * 0.6) return 2;
  return 1;
}

/**
 * Предлагает каскад ключевых колонок: ведущий ряд колонок-меток до первой
 * чисто-числовой метрики. Кодовые колонки (8, 8:01:06) остаются ключами.
 * Минимум одна колонка (первая) — ключ. Пользователь правит на шаге «Структура».
 */
export function detectKeyColumns(
  rows: string[][],
  columnCount: number,
  cfg?: EmptyConfig
): number[] {
  const keys: number[] = [];
  for (let c = 0; c < columnCount; c++) {
    const colValues = rows.map(r => r[c] ?? '');
    if (isMetricColumn(colValues, cfg)) break;
    keys.push(c);
  }
  return keys.length > 0 ? keys : [0];
}

/**
 * Строит колонки с ролями и составными именами.
 * `headerMatrix` — 1 или 2 строки шапки. Верхняя (групповая) forward-fill'ится
 * вправо (имитация объединённых ячеек), нижняя — имена колонок.
 */
export function buildColumns(
  headerMatrix: string[][],
  keyColumns: number[],
  rows: string[][],
  cfg?: EmptyConfig
): AggregateColumn[] {
  const hasGroupRow = headerMatrix.length >= 2;
  const groupRow = hasGroupRow ? headerMatrix[0] : [];
  const nameRow = hasGroupRow ? headerMatrix[1] : (headerMatrix[0] ?? []);
  const columnCount = Math.max(
    nameRow.length,
    ...rows.map(r => r.length),
    keyColumns.length ? Math.max(...keyColumns) + 1 : 0
  );

  // Forward-fill групповой строки: значение «протекает» вправо до след. непустого.
  const filledGroups: string[] = [];
  let carry = '';
  for (let c = 0; c < columnCount; c++) {
    const g = (groupRow[c] ?? '').trim();
    if (g !== '') carry = g;
    filledGroups[c] = carry;
  }

  const keySet = new Set(keyColumns);
  const columns: AggregateColumn[] = [];
  for (let c = 0; c < columnCount; c++) {
    const name = (nameRow[c] ?? '').trim();
    const groupName = hasGroupRow ? filledGroups[c] : '';
    const fullName = groupName && groupName !== name ? `${groupName} · ${name}` : name;
    let role: ColumnRole;
    if (keySet.has(c)) {
      role = 'key';
    } else {
      const colValues = rows.map(r => r[c] ?? '');
      role = isMetricColumn(colValues, cfg) ? 'metric' : 'attribute';
    }
    columns.push({ index: c, groupName, name, fullName, role });
  }
  return columns;
}

/**
 * Классифицирует строку: уровень (глубина каскада), тип (лист/узел/итого),
 * метку. `keyColumns` — порядок каскада; глубина = индекс самого правого
 * заполненного ключа.
 */
export function classifyRow(
  cells: string[],
  keyColumns: number[],
  opts?: { empty?: EmptyConfig; totalKeywords?: string[] }
): ClassifiedRow {
  const cfg = opts?.empty;
  const keywords = (opts?.totalKeywords ?? DEFAULT_TOTAL_KEYWORDS).map(k => k.toLowerCase());

  let deepest = -1;
  let label = '';
  let totalLabel = '';
  for (let i = 0; i < keyColumns.length; i++) {
    const raw = cells[keyColumns[i]] ?? '';
    if (!isEmptyCell(raw, cfg)) {
      deepest = i;
      label = String(raw).trim();
      const lower = label.toLowerCase();
      if (keywords.some(k => lower.includes(k))) totalLabel = label;
    }
  }

  if (totalLabel) {
    return { cells, level: deepest, kind: 'total', label: totalLabel };
  }
  const isLeaf = deepest === keyColumns.length - 1 && deepest >= 0;
  return {
    cells,
    level: deepest,
    kind: isLeaf ? 'leaf' : 'node',
    label,
  };
}

/** Классифицирует все строки данных. */
export function classifyRows(
  rows: string[][],
  keyColumns: number[],
  opts?: { empty?: EmptyConfig; totalKeywords?: string[] }
): ClassifiedRow[] {
  return rows.map(cells => classifyRow(cells, keyColumns, opts));
}

export interface HierarchyPreviewNode {
  label: string;
  level: number;
  children: HierarchyPreviewNode[];
}

/**
 * Строит дерево иерархии из каскада ключей (для предпросмотра на шаге
 * «Структура»). Строки «Итого» в дерево не входят. Предполагается, что предки
 * повторяются в листовых строках (как в реальных выгрузках). Узлов не больше
 * `maxNodes`.
 */
export function buildHierarchyPreview(
  rows: ClassifiedRow[],
  keyColumns: number[],
  opts?: { empty?: EmptyConfig; maxNodes?: number }
): HierarchyPreviewNode[] {
  const cfg = opts?.empty;
  const max = opts?.maxNodes ?? 200;
  const roots: HierarchyPreviewNode[] = [];
  const byPath = new Map<string, HierarchyPreviewNode>();
  let count = 0;

  for (const row of rows) {
    if (row.kind === 'total' || row.level < 0) continue;
    let parent = roots;
    let pathKey = '';
    for (let i = 0; i <= row.level; i++) {
      const raw = row.cells[keyColumns[i]] ?? '';
      if (isEmptyCell(raw, cfg)) break; // пропуск предка — дальше не строим
      const part = String(raw).trim();
      pathKey = pathKey ? `${pathKey}${part}` : part;
      let node = byPath.get(pathKey);
      if (!node) {
        if (count >= max) return roots;
        node = { label: part, level: i, children: [] };
        byPath.set(pathKey, node);
        parent.push(node);
        count++;
      }
      parent = node.children;
    }
  }
  return roots;
}

export interface ProposedGroup {
  /** Имя верхнего заголовка шапки (источник группы). '' — без группы. */
  groupName: string;
  /** Колонки-метрики этой группы (составные имена). */
  metrics: string[];
}

/**
 * Предлагает группы показателей по верхним заголовкам шапки: метрики с общим
 * `groupName` объединяются в одну группу. Пользователь выбирает чекбоксами,
 * что создавать (UI шага «Структура»).
 */
export function proposeGroups(columns: AggregateColumn[]): ProposedGroup[] {
  const byGroup = new Map<string, string[]>();
  for (const col of columns) {
    if (col.role !== 'metric') continue;
    const key = col.groupName || '';
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(col.fullName);
  }
  return Array.from(byGroup.entries()).map(([groupName, metrics]) => ({ groupName, metrics }));
}

// ─────────────────────────────────────────────────────────────
// Сплющивание в листья (фаза 1) — плоская таблица для текущего движка.
// ─────────────────────────────────────────────────────────────

/** Подтверждённая пользователем разметка для сплющивания. */
export interface AggregateLayoutConfig {
  headerRows: number;
  keyColumns: number[];
  empty?: EmptyConfig;
  totalKeywords?: string[];
  /** Группы шапки, которые НЕ создавать (имена как в proposeGroups). */
  excludeGroups?: string[];
}

export interface FlattenResult {
  /** Колонки результата с ролями/именами. */
  columns: AggregateColumn[];
  /** Составные имена колонок (заголовок плоской таблицы). */
  headers: string[];
  /** Только листовые строки; метки предков протащены (carry-forward). */
  rows: string[][];
  /** Имена ключевых колонок в порядке каскада (→ уровни иерархии). */
  keyColumnNames: string[];
  /** Имена колонок-метрик. */
  metricColumnNames: string[];
}

/**
 * Сплющивает агрегат в плоскую таблицу ЛИСТЬЕВ (фаза 1).
 *
 * Берёт только листовые строки (самый глубокий заполненный ключ), протаскивая
 * метки предков сверху вниз (carry-forward) — работает и когда листы повторяют
 * предков, и когда заполнен только свой уровень (outline). Узлы и «Итого»
 * отбрасываются → двойного счёта нет. Метрики/атрибуты берутся из самой
 * листовой строки. Предпосчитанные значения узлов в фазе 1 НЕ сохраняются.
 */
export function flattenLeaves(
  matrix: string[][],
  config: AggregateLayoutConfig
): FlattenResult {
  const { headerRows, keyColumns, empty, totalKeywords } = config;
  const headerMatrix = matrix.slice(0, headerRows);
  const dataRows = matrix.slice(headerRows);
  const columns = buildColumns(headerMatrix, keyColumns, dataRows, empty);
  const classified = classifyRows(dataRows, keyColumns, { empty, totalKeywords });

  const keyOrdinalByIndex = new Map<number, number>();
  keyColumns.forEach((colIdx, ord) => keyOrdinalByIndex.set(colIdx, ord));

  const currentKeys: string[] = [];
  const rows: string[][] = [];

  for (const row of classified) {
    if (row.kind === 'total' || row.level < 0) continue;
    // Обновляем путь: каждый заполненный ключ строки + сброс глубже её уровня.
    for (let i = 0; i < keyColumns.length; i++) {
      const v = row.cells[keyColumns[i]] ?? '';
      if (!isEmptyCell(v, empty)) currentKeys[i] = String(v).trim();
    }
    currentKeys.length = row.level + 1;

    if (row.kind !== 'leaf') continue;

    rows.push(
      columns.map(col => {
        const ord = keyOrdinalByIndex.get(col.index);
        if (ord !== undefined) return currentKeys[ord] ?? '';
        return row.cells[col.index] ?? '';
      })
    );
  }

  return {
    columns,
    headers: columns.map(c => c.fullName),
    rows,
    keyColumnNames: columns.filter(c => c.role === 'key').map(c => c.fullName),
    metricColumnNames: columns.filter(c => c.role === 'metric').map(c => c.fullName),
  };
}

/** Приводит число к каноничному виду (точка-десятичная, без разрядов).
 *  RU-ориентировано: пробелы — тысячи, запятая — десятичная. */
function canonicalNumber(s: string): string {
  return s.replace(/\s/g, '').replace(',', '.');
}

/** Парсит ячейку-метрику в число; пусто/нечисло → null. */
export function parseMetricValue(s: string | null | undefined, cfg?: EmptyConfig): number | null {
  if (isEmptyCell(s, cfg)) return null;
  const n = Number(canonicalNumber(String(s).trim()));
  return Number.isFinite(n) ? n : null;
}

// ─────────────────────────────────────────────────────────────
// Извлечение узлов (фаза 2) — введённые/предпосчитанные значения уровней.
// ─────────────────────────────────────────────────────────────

export interface AggregateNode {
  /** Путь значений ключевых колонок от корня до узла. */
  path: string[];
  /** Уровень = глубина в каскаде (индекс самого правого ключа). */
  level: number;
  /** Метка узла (последний элемент пути). */
  label: string;
  /** Это строка «Итого/Всего»? */
  isTotal: boolean;
  /** Введённые значения метрик по составному имени колонки. */
  values: Record<string, number | null>;
}

/** Стабильный ключ узла из пути (для словаря узлов). */
export function nodePathKey(path: string[]): string {
  return path.join('');
}

/**
 * Извлекает УЗЛЫ агрегата (промежуточные строки-уровни и «Итого») с их
 * введёнными метриками — фаза 2. Листья пропускаются (их значения считает
 * движок по таблице). Путь узла собирается carry-forward, как в flattenLeaves.
 */
export function extractNodes(
  matrix: string[][],
  config: AggregateLayoutConfig
): AggregateNode[] {
  const { headerRows, keyColumns, empty, totalKeywords } = config;
  const headerMatrix = matrix.slice(0, headerRows);
  const dataRows = matrix.slice(headerRows);
  const columns = buildColumns(headerMatrix, keyColumns, dataRows, empty);
  const classified = classifyRows(dataRows, keyColumns, { empty, totalKeywords });
  const metricCols = columns.filter(c => c.role === 'metric');

  const currentKeys: string[] = [];
  const nodes: AggregateNode[] = [];

  for (const row of classified) {
    if (row.level >= 0) {
      for (let i = 0; i < keyColumns.length; i++) {
        const v = row.cells[keyColumns[i]] ?? '';
        if (!isEmptyCell(v, empty)) currentKeys[i] = String(v).trim();
      }
      currentKeys.length = row.level + 1;
    }
    if (row.kind === 'leaf') continue;

    // узел/итого: путь + введённые значения метрик
    const path = row.level >= 0 ? currentKeys.slice(0, row.level + 1) : [row.label];
    const values: Record<string, number | null> = {};
    for (const col of metricCols) {
      values[col.fullName] = parseMetricValue(row.cells[col.index], empty);
    }
    nodes.push({
      path,
      level: row.level,
      label: row.label,
      isTotal: row.kind === 'total',
      values,
    });
  }
  return nodes;
}

/** Экранирует поле CSV (кавычки/запятая/перевод строки). */
function csvField(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Собирает CSV из результата сплющивания. Метрики канонизируются к точке-
 * десятичной (для нативного read_csv_auto с decimal_separator='.'); ключи и
 * атрибуты — как есть (текст/коды). Разделитель — запятая.
 */
export function toAggregateCsv(result: FlattenResult): string {
  // result.rows выровнены с result.columns по позиции.
  const isMetric = result.columns.map(c => c.role === 'metric');
  const lines: string[] = [result.headers.map(csvField).join(',')];
  for (const row of result.rows) {
    const out = row.map((raw, pos) =>
      csvField(isMetric[pos] ? canonicalNumber(raw ?? '') : (raw ?? ''))
    );
    lines.push(out.join(','));
  }
  return lines.join('\n');
}
