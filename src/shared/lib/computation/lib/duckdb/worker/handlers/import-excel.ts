/// <reference lib="webworker" />

import { logger } from '@/shared/lib/logger';
import { tableFromJSON } from 'apache-arrow';
import { transliterate } from '@/shared/lib/utils/translit';
import { buildTableName } from '../../table-name';
import { parseExcelToJson, classifyColumn } from '../../excel-parser';
import { requireConn, requireDb, invalidateTableCaches } from '../runtime';
import {
  yieldToEventLoop,
  isCsvFileName,
  sqlStr,
  toNumber,
  rowsToCsvBuffer,
  buildClassificationSample,
  logImportTimings,
} from '../lib';
import type { ImportExcelPayload, ImportParseOptions } from '../messages';

/**
 * Быстрый импорт CSV: исходный буфер отдаётся DuckDB через `read_csv_auto`
 * (без SheetJS). Уважает выбранные пользователем разделитель, десятичный
 * разделитель и типы (categorical/ignore → VARCHAR, чтобы сохранить коды
 * с ведущими нулями). Это путь ~×10 быстрее SheetJS для больших CSV.
 */
async function importCsvNative(
  datasetId: string,
  fileName: string,
  buffer: ArrayBuffer,
  opts: ImportParseOptions,
  id: number
): Promise<void> {
  const conn = requireConn();
  const db = requireDb();
  const tableName = buildTableName(datasetId);
  const tStart = performance.now();

  await conn.query(`DROP TABLE IF EXISTS ${tableName}`);
  invalidateTableCaches(tableName);

  const csvFileName = `${datasetId}_import.csv`;
  db.registerFileBuffer(csvFileName, new Uint8Array(buffer));

  const varcharCols = Object.entries(opts.columnTypes)
    .filter(([, t]) => t === 'categorical' || t === 'ignore')
    .map(([name]) => `'${sqlStr(name)}': 'VARCHAR'`);
  const typesClause = varcharCols.length ? `, types = {${varcharCols.join(', ')}}` : '';
  // RU-даты (`15.03.2024`) авто-детект DuckDB не разбирает — навязываем формат.
  const dateClause = opts.dateFormat
    ? `, dateformat = '${sqlStr(opts.dateFormat)}'`
    : '';

  const buildSql = (withTypes: boolean) => `
    CREATE TABLE ${tableName} AS SELECT * FROM read_csv_auto(
      '${csvFileName}',
      sample_size = 20000,
      auto_detect = true,
      ignore_errors = true,
      null_padding = true,
      all_varchar = false,
      header = true,
      delim = '${sqlStr(opts.delimiter)}',
      decimal_separator = '${sqlStr(opts.decimalSeparator)}',
      quote = '"'${dateClause}${withTypes ? typesClause : ''}
    )
  `;

  try {
    await conn.query(buildSql(true));
  } catch (err) {
    // Имя колонки в types могло не совпасть с заголовком файла — повторяем
    // без жёстких типов (классификация всё равно применится на стороне UI).
    if (typesClause) {
      logger.warn('[Worker] read_csv types override failed, retrying without:', err);
      await conn.query(`DROP TABLE IF EXISTS ${tableName}`);
      await conn.query(buildSql(false));
    } else {
      throw err;
    }
  }

  // TIME → VARCHAR (как в прежнем CSV-пути): тип TIME неудобен для UI.
  const schema = (await conn.query(`DESCRIBE ${tableName}`)).toArray() as Array<{
    column_name: string;
    column_type: string;
  }>;
  for (const row of schema) {
    const t = row.column_type.toUpperCase();
    if (t === 'TIME' || t === 'TIME WITH TIME ZONE') {
      await conn.query(
        `ALTER TABLE ${tableName} ALTER COLUMN "${row.column_name}" TYPE VARCHAR`
      );
    }
  }

  const finalSchema = (await conn.query(`DESCRIBE ${tableName}`)).toArray() as Array<{
    column_name: string;
    column_type: string;
  }>;
  const configs = finalSchema.map((row, idx) => {
    const duckType = row.column_type.toUpperCase();
    let classification: 'numeric' | 'date' | 'categorical' = 'categorical';
    if (/INT|DECIMAL|FLOAT|DOUBLE|NUMERIC|HUGEINT|REAL/.test(duckType)) {
      classification = 'numeric';
    } else if (duckType.includes('DATE') || duckType.includes('TIMESTAMP')) {
      classification = 'date';
    }
    return {
      columnName: row.column_name,
      displayName: row.column_name,
      alias: transliterate(row.column_name) || `col_${idx}`,
      classification,
      description: `Из файла ${fileName}`,
    };
  });

  const countRes = await conn.query(`SELECT COUNT(*) as cnt FROM ${tableName}`);
  const totalRows = Number(
    toNumber((countRes.toArray()[0] as Record<string, unknown>).cnt) ?? 0
  );

  logger.info(
    `[Worker] ⏱️ Import profile (csv-native, ${totalRows.toLocaleString()} rows, ` +
      `${Math.round(performance.now() - tStart)}ms)`
  );

  self.postMessage({
    id,
    success: true,
    result: { configs, totalRows, totalColumns: configs.length, sheetNames: [] },
  });
}

/**
 * IMPORT_EXCEL — импорт файла в таблицу DuckDB. CSV с явными параметрами идёт
 * нативным read_csv_auto; иначе — SheetJS-парсинг + стратегия A (batched Arrow
 * для больших) или B (read_csv через CSV-буфер для маленьких).
 */
export async function handleImportExcel(id: number, payload: ImportExcelPayload): Promise<void> {
  const { datasetId, fileName, buffer, parseOptions } = payload;
  const tableName = buildTableName(datasetId);
  const conn = requireConn();
  const db = requireDb();

  // ── Быстрый путь: CSV с явными параметрами → нативный read_csv_auto.
  // Отдаём исходный буфер прямо DuckDB (без SheetJS): порядок быстрее
  // и уважает выбранные разделитель/десятичный/типы колонок.
  if (parseOptions && isCsvFileName(fileName)) {
    try {
      await importCsvNative(datasetId, fileName, buffer, parseOptions, id);
    } catch (err) {
      logger.error('[Worker] Native CSV import failed:', err);
      self.postMessage({
        id,
        success: false,
        error: err instanceof Error ? err.message : 'Import failed',
      });
    }
    return;
  }

  try {
    // ─── ЭТАП 1: Парсинг Excel в JSON ───────────────────────
    await yieldToEventLoop();

    const { flatRows, sheetNames, headers, timings } = parseExcelToJson(buffer);

    if (flatRows.length === 0) {
      throw new Error('Файл пуст или не содержит валидных данных');
    }

    logger.debug(
      `[Worker] 📄 Parsed ${flatRows.length} rows, ${headers.length} columns from ${fileName}`
    );

    // ─── ЭТАП 2: Выбор стратегии импорта ────────────────────
    const BATCH_THRESHOLD = 50_000;
    const useBatchedInsert = flatRows.length > BATCH_THRESHOLD;

    // Профилирование импорта (см. ROADMAP «Производительность обработки
    // файлов»): засекаем фазу вставки, чтобы сопоставить с фазами парсинга.
    const tInsertStart = performance.now();

    await conn.query(`DROP TABLE IF EXISTS ${tableName}`);
    invalidateTableCaches(tableName);

    let classificationSample: Record<string, unknown[]> = {};

    if (useBatchedInsert) {
      // ═══════════════════════════════════════════════════════
      // СТРАТЕГИЯ A: Batched Arrow insert (для больших файлов)
      // ═══════════════════════════════════════════════════════
      const BATCH_SIZE = 25_000;
      const totalBatches = Math.ceil(flatRows.length / BATCH_SIZE);
      // Имя последней созданной temp-таблицы — для отката (№16): при ошибке
      // батча сбрасываем и temp, и частично заполненную целевую таблицу,
      // иначе остаётся «полуимпорт», который COUNT(*) не ловит как ошибку.
      let pendingTempTable: string | null = null;

      try {
        for (let i = 0; i < flatRows.length; i += BATCH_SIZE) {
          const chunk = flatRows.slice(i, i + BATCH_SIZE);
          const isFirstBatch = i === 0;
          const batchIndex = Math.floor(i / BATCH_SIZE) + 1;

          const arrowTable = tableFromJSON(chunk);

          if (isFirstBatch) {
            // Первый батч — создаём таблицу
            await conn.insertArrowTable(arrowTable, {
              name: tableName,
              create: true,
            });
          } else {
            const tempTableName = `${tableName}_batch_${batchIndex}`;
            pendingTempTable = tempTableName;
            await conn.insertArrowTable(arrowTable, {
              name: tempTableName,
              create: true,
            });

            // Явный INSERT INTO — гарантированно добавляет данные
            await conn.query(
              `INSERT INTO ${tableName} SELECT * FROM ${tempTableName}`
            );

            // Удаляем временную таблицу
            await conn.query(`DROP TABLE IF EXISTS ${tempTableName}`);
            pendingTempTable = null;
          }

          // Отдаём управление event loop между батчами
          await yieldToEventLoop();

          // Прогресс-репорт в UI
          if (batchIndex % 5 === 0 || batchIndex === totalBatches) {
            self.postMessage({
              id,
              type: 'PROGRESS',
              progress: {
                phase: 'import',
                current: i + chunk.length,
                total: flatRows.length,
                percent: Math.round(((i + chunk.length) / flatRows.length) * 100),
              },
            });
          }
        }
      } catch (batchErr) {
        // Откат: не оставляем частично заполненную таблицу под видом готовой.
        if (pendingTempTable) {
          await conn.query(`DROP TABLE IF EXISTS ${pendingTempTable}`).catch(() => {});
        }
        await conn.query(`DROP TABLE IF EXISTS ${tableName}`).catch(() => {});
        invalidateTableCaches(tableName);
        throw batchErr;
      }

      const countResult = await conn.query(
        `SELECT COUNT(*) as cnt FROM ${tableName}`
      );
      const actualRows = Number(
        toNumber((countResult.toArray()[0] as Record<string, unknown>).cnt) ?? 0
      );

      logger.debug(
        `[Worker] ✅ Batched insert completed: ${totalBatches} batches, ` +
        `${actualRows.toLocaleString()} rows in table (expected: ${flatRows.length.toLocaleString()})`
      );

      if (actualRows !== flatRows.length) {
        logger.warn(
          `[Worker] ⚠️ Row count mismatch! Expected ${flatRows.length}, got ${actualRows}. ` +
          `Some batches may have failed silently.`
        );
      }

      // Сэмпл для классификации
      const sampleRows = flatRows.slice(0, 100);
      classificationSample = buildClassificationSample(headers, sampleRows);
    } else {
      // ═══════════════════════════════════════════════════════
      // СТРАТЕГИЯ B: CSV через read_csv_auto (для маленьких файлов)
      // ═══════════════════════════════════════════════════════
      const csvBuffer = rowsToCsvBuffer(flatRows, headers);
      const csvFileName = `${datasetId}_import.csv`;
      db.registerFileBuffer(csvFileName, csvBuffer);

      await conn.query(`
        CREATE TABLE ${tableName} AS
        SELECT * FROM read_csv_auto(
          '${csvFileName}',
          sample_size = 20000,
          auto_detect = true,
          ignore_errors = true,
          null_padding = true,
          all_varchar = false,
          delim = ',',
          quote = '"'
        )
      `);

      // Приведение TIME-типов к VARCHAR
      const schemaResult = await conn.query(`DESCRIBE ${tableName}`);
      const schemaRows = schemaResult.toArray() as Array<{
        column_name: string;
        column_type: string;
      }>;
      for (const row of schemaRows) {
        const duckType = row.column_type.toUpperCase();
        if (duckType === 'TIME' || duckType === 'TIME WITH TIME ZONE') {
          await conn.query(
            `ALTER TABLE ${tableName} ALTER COLUMN "${row.column_name}" TYPE VARCHAR`
          );
        }
      }

      const descResult = await conn.query(`DESCRIBE ${tableName}`);
      const finalSchema = descResult.toArray() as Array<{
        column_name: string;
        column_type: string;
      }>;

      const configs = finalSchema.map((row, idx) => {
        const duckType = row.column_type.toUpperCase();
        let classification: 'numeric' | 'date' | 'categorical' = 'categorical';
        if (
          duckType.includes('INT') ||
          duckType.includes('DECIMAL') ||
          duckType.includes('FLOAT') ||
          duckType.includes('DOUBLE') ||
          duckType.includes('NUMERIC') ||
          duckType.includes('HUGEINT')
        ) {
          classification = 'numeric';
        } else if (duckType.includes('DATE') || duckType.includes('TIMESTAMP')) {
          classification = 'date';
        }
        return {
          columnName: row.column_name,
          displayName: row.column_name,
          alias: transliterate(row.column_name) || `col_${idx}`,
          classification,
          description: `Из файла ${fileName}`,
        };
      });

      const countResult = await conn.query(
        `SELECT COUNT(*) as cnt FROM ${tableName}`
      );
      const totalRows = Number(
        toNumber((countResult.toArray()[0] as Record<string, unknown>).cnt) ?? 0
      );

      logImportTimings('csv', timings, performance.now() - tInsertStart, flatRows.length);

      self.postMessage({
        id,
        success: true,
        result: {
          configs,
          totalRows,
          totalColumns: configs.length,
          sheetNames,
        },
      });
      return;
    }

    // ─── ЭТАП 3: Построение конфигов (для стратегии A) ──────
    const configs = headers.map((col, idx) => {
      const sample = classificationSample[col] ?? [];
      const classification = classifyColumn(sample);
      return {
        columnName: col,
        displayName: col,
        alias: transliterate(col) || `col_${idx}`,
        classification,
        description: `Из файла ${fileName}`,
      };
    });

    const finalCountResult = await conn.query(
      `SELECT COUNT(*) as cnt FROM ${tableName}`
    );
    const finalTotalRows = Number(
      toNumber((finalCountResult.toArray()[0] as Record<string, unknown>).cnt) ?? 0
    );

    logImportTimings('batched', timings, performance.now() - tInsertStart, flatRows.length);

    self.postMessage({
      id,
      success: true,
      result: {
        configs,
        totalRows: finalTotalRows,
        totalColumns: configs.length,
        sheetNames,
      },
    });
  } catch (err) {
    logger.error('[Worker] IMPORT_EXCEL failed:', err);
    self.postMessage({
      id,
      success: false,
      error: err instanceof Error ? err.message : 'Import failed',
    });
  }
}
