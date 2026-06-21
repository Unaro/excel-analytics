import { describe, it, expect } from 'vitest';
import {
  isEmptyCell,
  isMetricColumn,
  detectKeyColumns,
  detectHeaderRows,
  buildColumns,
  classifyRow,
  classifyRows,
  buildHierarchyPreview,
  proposeGroups,
  flattenLeaves,
  toAggregateCsv,
} from './aggregate-layout';

// Каскад ключей: Регион(0) → Город(1) → Зона(2, код) → Объект(3, GUID),
// затем метрики Площадь(4), Численность(5). Зеркалит реальную выгрузку.
const KEYS = [0, 1, 2, 3];
const ROWS: string[][] = [
  ['Тюменская обл', '', '', '', '', '1639132'],          // город-итог (узел, level 0)
  ['Тюменская обл', 'Тюмень', '', '', '', '88701'],      // узел level 1
  ['Тюменская обл', 'Тюмень', '8:01:06', '', '0,144', ''], // зона-узел level 2 (зелёная)
  ['Тюменская обл', 'Тюмень', '8:01:06', '{guid1}', '1,45', '0'], // лист
  ['Тюменская обл', 'Тюмень', '8:01:06', '{guid2}', '6,91', '1'], // лист
  ['Итого', '', '', '', '', '1727833'],                  // строка «Итого»
];

describe('isEmptyCell: 0 — не пустота, токены настраиваются', () => {
  it('пустая ячейка и пробелы → пусто', () => {
    expect(isEmptyCell('')).toBe(true);
    expect(isEmptyCell('   ')).toBe(true);
    expect(isEmptyCell(null)).toBe(true);
  });
  it('0 НЕ считается пустотой', () => {
    expect(isEmptyCell('0')).toBe(false);
  });
  it('пользовательские токены пустоты', () => {
    expect(isEmptyCell('—', { tokens: ['—', 'н/д'] })).toBe(true);
    expect(isEmptyCell('Н/Д', { tokens: ['—', 'н/д'] })).toBe(true);
    expect(isEmptyCell('5', { tokens: ['—'] })).toBe(false);
  });
});

describe('isMetricColumn: число vs код/текст', () => {
  it('числовая колонка → метрика', () => {
    expect(isMetricColumn(['1,45', '6,91', '0', '88701'])).toBe(true);
  });
  it('кодовая колонка (8:01:06) → не метрика', () => {
    expect(isMetricColumn(['8:01:06', '8:02:04', '8:01:06'])).toBe(false);
  });
  it('текстовая колонка → не метрика', () => {
    expect(isMetricColumn(['Тюмень', 'Тюмень', ''])).toBe(false);
  });
  it('ведущий ноль (код) → не метрика', () => {
    expect(isMetricColumn(['007', '012', '003'])).toBe(false);
  });
});

describe('detectKeyColumns: каскад до первой метрики', () => {
  it('ведущие метки/коды — ключи, число обрывает каскад', () => {
    expect(detectKeyColumns(ROWS, 6)).toEqual([0, 1, 2, 3]);
  });
  it('минимум одна колонка-ключ', () => {
    expect(detectKeyColumns([['10', '20']], 2)).toEqual([0]);
  });
});

describe('detectHeaderRows: одно- vs двухстрочная шапка', () => {
  it('разреженная групповая строка над плотной → 2', () => {
    const matrix = [
      ['Расположение', '', '', 'Дошкольные', ''],          // группы (разреженно)
      ['Регион', 'Город', 'Зона', 'Потребность', 'Мощность'], // имена (плотно)
      ['Обл', 'Гор', '8:01', '10', '20'],
      ['Обл', 'Гор', '8:02', '11', '21'],
    ];
    expect(detectHeaderRows(matrix)).toBe(2);
  });
  it('плотная первая строка → 1', () => {
    const matrix = [
      ['Регион', 'Город', 'Зона', 'Потребность', 'Мощность'],
      ['Обл', 'Гор', '8:01', '10', '20'],
      ['Обл', 'Гор', '8:02', '11', '21'],
    ];
    expect(detectHeaderRows(matrix)).toBe(1);
  });
});

describe('classifyRow: уровень / лист-узел-итого', () => {
  it('лист = заполнен самый глубокий ключ', () => {
    const r = classifyRow(ROWS[3], KEYS);
    expect(r.kind).toBe('leaf');
    expect(r.level).toBe(3);
    expect(r.label).toBe('{guid1}');
  });
  it('промежуточный узел (зона)', () => {
    const r = classifyRow(ROWS[2], KEYS);
    expect(r.kind).toBe('node');
    expect(r.level).toBe(2);
    expect(r.label).toBe('8:01:06');
  });
  it('верхний узел (город)', () => {
    const r = classifyRow(ROWS[0], KEYS);
    expect(r.kind).toBe('node');
    expect(r.level).toBe(0);
  });
  it('строка «Итого» по ключевому слову', () => {
    const r = classifyRow(ROWS[5], KEYS);
    expect(r.kind).toBe('total');
    expect(r.label).toBe('Итого');
  });
  it('«Итоговая» в МЕТРИКЕ не делает строку total (ключи чисты)', () => {
    // ключевое слово ищется только в ключевых колонках
    const row = ['Тюменская обл', 'Тюмень', '8:01:06', '{g}', '1,2', 'Итоговая'];
    expect(classifyRow(row, KEYS).kind).toBe('leaf');
  });
});

describe('buildColumns: составные имена из multi-row шапки', () => {
  const header = [
    ['Расположение', '', '', 'Дошкольные', ''], // групповая строка (объединённые)
    ['Регион', 'Город', 'Зона', 'Потребность', 'Мощность'],
  ];
  const rows = [['Обл', 'Гор', '8:01', '10', '20']];
  const cols = buildColumns(header, [0, 1, 2], rows);

  it('forward-fill группы + составное имя', () => {
    expect(cols[0].fullName).toBe('Расположение · Регион');
    expect(cols[2].fullName).toBe('Расположение · Зона');
    expect(cols[3].fullName).toBe('Дошкольные · Потребность');
  });
  it('роли: ключ / метрика', () => {
    expect(cols[0].role).toBe('key');
    expect(cols[3].role).toBe('metric');
  });
});

describe('buildHierarchyPreview: дерево из каскада', () => {
  it('строит вложенность, «Итого» исключается', () => {
    const tree = buildHierarchyPreview(classifyRows(ROWS, KEYS), KEYS);
    expect(tree).toHaveLength(1);
    expect(tree[0].label).toBe('Тюменская обл');
    const city = tree[0].children[0];
    expect(city.label).toBe('Тюмень');
    const zone = city.children[0];
    expect(zone.label).toBe('8:01:06');
    expect(zone.children.map(n => n.label)).toEqual(['{guid1}', '{guid2}']);
  });
});

describe('flattenLeaves: только листья + протаскивание предков', () => {
  it('берёт листья, отбрасывает узлы/итого, тянет предков', () => {
    const res = flattenLeaves(ROWS, { headerRows: 0, keyColumns: KEYS });
    // только 2 листа (guid1, guid2); узлы города/зоны и «Итого» исключены
    expect(res.rows).toHaveLength(2);
    // у листа предки протащены (Регион/Город/Зона заполнены)
    expect(res.rows[0].slice(0, 4)).toEqual(['Тюменская обл', 'Тюмень', '8:01:06', '{guid1}']);
    expect(res.rows[1].slice(0, 4)).toEqual(['Тюменская обл', 'Тюмень', '8:01:06', '{guid2}']);
  });

  it('carry-forward, когда лист не повторяет предков (outline)', () => {
    const rows = [
      ['Обл', '', '', '', '', ''],          // узел level 0
      ['', 'Гор', '', '', '', ''],           // узел level 1 (предок не повторён)
      ['', '', '8:01', '{g1}', '1,5', '0'],  // лист level 3 (только свой уровень + код зоны)
    ];
    // keyColumns 0..3; лист имеет зону и guid, но не Обл/Гор → берём из carry
    const res = flattenLeaves(rows, { headerRows: 0, keyColumns: [0, 1, 2, 3] });
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].slice(0, 4)).toEqual(['Обл', 'Гор', '8:01', '{g1}']);
  });
});

describe('toAggregateCsv: канонизация метрик, экранирование', () => {
  it('метрики → точка-десятичная, пробелы-тысячи убраны', () => {
    const header = [['Регион', 'Площадь', 'Численность']];
    const rows = [['Обл', '12,5', '1 639 132']];
    const res = flattenLeaves([...header, ...rows], { headerRows: 1, keyColumns: [0] });
    const csv = toAggregateCsv(res);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Регион,Площадь,Численность');
    expect(lines[1]).toBe('Обл,12.5,1639132');
  });
  it('экранирует запятые/кавычки в текстовых полях', () => {
    const res = flattenLeaves(
      [['Имя', 'Площадь'], ['А, "Б"', '1,2']],
      { headerRows: 1, keyColumns: [0] }
    );
    const csv = toAggregateCsv(res);
    expect(csv.split('\n')[1]).toBe('"А, ""Б""",1.2');
  });
});

describe('proposeGroups: группы по верхнему заголовку', () => {
  it('метрики одной группы шапки → одна группа', () => {
    const header = [
      ['', '', 'Дошкольные', ''],
      ['Регион', 'Площадь', 'Потребность', 'Мощность'],
    ];
    const rows = [['Обл', '12,5', '10', '20']];
    const cols = buildColumns(header, [0], rows);
    const groups = proposeGroups(cols);
    const doo = groups.find(g => g.groupName === 'Дошкольные');
    expect(doo?.metrics).toEqual(['Дошкольные · Потребность', 'Дошкольные · Мощность']);
  });
});
