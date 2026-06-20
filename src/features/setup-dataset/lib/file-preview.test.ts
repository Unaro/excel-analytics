import { describe, it, expect } from 'vitest';
import {
  detectDelimiter,
  detectLineEnding,
  parseCsvPreview,
  buildFilePreview,
  isCsvFileName,
} from './file-preview';

const encode = (s: string) => new TextEncoder().encode(s).buffer;

describe('isCsvFileName: текст vs xlsx', () => {
  it('csv/txt/без расширения — текст', () => {
    expect(isCsvFileName('data.csv')).toBe(true);
    expect(isCsvFileName('data.CSV')).toBe(true);
    expect(isCsvFileName('export.txt')).toBe(true);
  });
  it('xlsx/xls — не текст', () => {
    expect(isCsvFileName('book.xlsx')).toBe(false);
    expect(isCsvFileName('old.XLS')).toBe(false);
  });
});

describe('detectDelimiter: разделитель по заголовку', () => {
  it('запятая по умолчанию', () => {
    expect(detectDelimiter('a,b,c')).toBe(',');
  });
  it('точка с запятой выигрывает при большем числе', () => {
    expect(detectDelimiter('a;b;c;d')).toBe(';');
  });
  it('таб', () => {
    expect(detectDelimiter('a\tb\tc')).toBe('\t');
  });
  it('игнорирует разделители внутри кавычек', () => {
    // в кавычках 3 запятых, вне — 1 точка с запятой
    expect(detectDelimiter('"a,b,c,d";e')).toBe(';');
  });
});

describe('detectLineEnding: разделитель строк', () => {
  it('LF', () => expect(detectLineEnding('a,b\n1,2')).toBe('\n'));
  it('CRLF', () => expect(detectLineEnding('a,b\r\n1,2')).toBe('\r\n'));
  it('CR (классический Mac)', () => expect(detectLineEnding('a,b\r1,2')).toBe('\r'));
  it('нет переводов строк → LF по умолчанию', () =>
    expect(detectLineEnding('a,b,c')).toBe('\n'));
});

describe('parseCsvPreview: разбор с кавычками и лимитом', () => {
  it('простые строки', () => {
    const rows = parseCsvPreview('a,b\n1,2\n3,4', ',', 50);
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('кавычки: разделитель и экранированная кавычка внутри поля', () => {
    const rows = parseCsvPreview('name,note\n"Иванов, А.","сказал ""да"""', ',', 50);
    expect(rows[1]).toEqual(['Иванов, А.', 'сказал "да"']);
  });

  it('лимит строк: заголовок + maxRows', () => {
    const rows = parseCsvPreview('h\n1\n2\n3\n4', ',', 2);
    // заголовок + 2 строки данных
    expect(rows).toEqual([['h'], ['1'], ['2']]);
  });

  it('CRLF и хвост без перевода строки', () => {
    const rows = parseCsvPreview('a,b\r\n1,2', ',', 50);
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('CR-only (классический Mac) корректно бьётся на строки', () => {
    const rows = parseCsvPreview('a,b\r1,2\r3,4', ',', 50);
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });
});

describe('buildFilePreview: CSV', () => {
  it('детектит ; и режет заголовок от данных', () => {
    const preview = buildFilePreview(
      encode('Код;Имя\n01:01;Район\n01:02;Микрорайон'),
      'test.csv'
    );
    expect(preview.isCsv).toBe(true);
    expect(preview.delimiter).toBe(';');
    expect(preview.newline).toBe('\n');
    expect(preview.headers).toEqual(['Код', 'Имя']);
    expect(preview.rows).toEqual([
      ['01:01', 'Район'],
      ['01:02', 'Микрорайон'],
    ]);
  });

  it('CRLF определяется и заголовок режется корректно', () => {
    const preview = buildFilePreview(
      encode('a,b\r\n1,2\r\n3,4'),
      'win.csv'
    );
    expect(preview.newline).toBe('\r\n');
    expect(preview.headers).toEqual(['a', 'b']);
    expect(preview.rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('явный разделитель переопределяет автодетект', () => {
    const preview = buildFilePreview(encode('a;b,c\n1;2,3'), 'x.csv', {
      delimiter: ',',
    });
    expect(preview.delimiter).toBe(',');
    expect(preview.headers).toEqual(['a;b', 'c']);
  });

  it('maxRows ограничивает число строк данных', () => {
    const preview = buildFilePreview(
      encode('h\n1\n2\n3\n4\n5'),
      'x.csv',
      { maxRows: 2 }
    );
    expect(preview.rows).toEqual([['1'], ['2']]);
    expect(preview.truncated).toBe(true);
  });
});
