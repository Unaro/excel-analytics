import { describe, it, expect } from 'vitest';
import { extractVariables } from './formula';

describe('extractVariables: переменные формулы', () => {
  it('простая арифметика — переменные по алиасам', () => {
    expect(extractVariables('a + b / 100').sort()).toEqual(['a', 'b']);
    expect(extractVariables('a/b*100').sort()).toEqual(['a', 'b']);
  });

  it('дубли не повторяются', () => {
    expect(extractVariables('a + a * a')).toEqual(['a']);
  });

  it('константы pi/e не считаются переменными', () => {
    expect(extractVariables('a * pi + e')).toEqual(['a']);
  });

  it('пустая/битая формула → []', () => {
    expect(extractVariables('')).toEqual([]);
    expect(extractVariables('   ')).toEqual([]);
    expect(extractVariables('a +')).toEqual([]); // синтаксическая ошибка
  });

  // ── Регрессия: имена функций НЕ должны попадать в переменные ──
  it('строчные функции не считаются переменными', () => {
    expect(extractVariables('round(a)')).toEqual(['a']);
    expect(extractVariables('max(a, b)').sort()).toEqual(['a', 'b']);
  });

  it('ПРОПИСНЫЕ агрегатные функции не считаются переменными', () => {
    // раньше давало ["MAX","a"] — MAX утекал как переменная
    expect(extractVariables('MAX(a)')).toEqual(['a']);
    expect(extractVariables('SUM(p)')).toEqual(['p']);
  });

  it('комбинация агрегатов: только реальные колонки', () => {
    expect(extractVariables('(MAX(a)/SUM(a)) - MIN(b)').sort()).toEqual(['a', 'b']);
  });

  it('переменная и функция с тем же именем-колонкой', () => {
    // a — и аргумент агрегата, и просто колонка; функция SUM исключается
    expect(extractVariables('SUM(a) + a').sort()).toEqual(['a']);
  });
});
