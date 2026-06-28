/// <reference lib="webworker" />

// Точка входа DuckDB-воркера: один self.onmessage маршрутизирует команды на
// обработчики (handlers/*). Состояние движка — runtime.ts, типы — messages.ts.
// Прежний монолит worker.ts разнесён по этому каталогу; интерфейс наружу тот же
// (протокол строковый), manager создаёт Worker по URL ./worker/index.ts.

import { logger } from '@/shared/lib/logger';
import { initDB, getConn } from './runtime';
import { markCancelled } from './cancel';
import type { WorkerMessage } from './messages';

import { handleConfigureEngine } from './handlers/configure-engine';
import { handleRegisterArrow, handleReloadArrow } from './handlers/register-arrow';
import { handleCompute } from './handlers/compute';
import { handleImportExcel } from './handlers/import-excel';
import { handleGetColumnPairs } from './handlers/column-pairs';
import { handleGetPreview } from './handlers/preview';
import { handleExportArrow, handleExportArrowChunked } from './handlers/export-arrow';
import { handleDropTable, handleCheckTable } from './handlers/table-ops';
import { handlePing } from './handlers/ping';

// Публичные типы протокола (manager / sync-engine импортируют ImportParseOptions).
export * from './messages';

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data as WorkerMessage;
  const { id } = msg;

  // CANCEL обрабатываем до initDB: отмена не должна ждать инициализации.
  // Ответ не шлём — менеджер уже отклонил промис задачи на своей стороне.
  if (msg.type === 'CANCEL') {
    markCancelled(msg.payload.targetId);
    return;
  }

  try {
    await initDB();

    if (!getConn()) {
      throw new Error('DuckDB connection was not established after initDB()');
    }

    switch (msg.type) {
      case 'CONFIGURE_ENGINE': await handleConfigureEngine(id, msg.payload); break;
      case 'REGISTER_ARROW': await handleRegisterArrow(id, msg.payload); break;
      case 'COMPUTE': await handleCompute(id, msg.payload); break;
      case 'IMPORT_EXCEL': await handleImportExcel(id, msg.payload); break;
      case 'GET_COLUMN_PAIRS': await handleGetColumnPairs(id, msg.payload); break;
      case 'GET_PREVIEW': await handleGetPreview(id, msg.payload); break;
      case 'EXPORT_ARROW': await handleExportArrow(id, msg.payload); break;
      case 'DROP_TABLE': await handleDropTable(id, msg.payload); break;
      case 'PING': await handlePing(id, msg.payload); break;
      case 'EXPORT_ARROW_CHUNKED': await handleExportArrowChunked(id, msg.payload); break;
      case 'CHECK_TABLE': await handleCheckTable(id, msg.payload); break;
      case 'RELOAD_ARROW': await handleReloadArrow(id, msg.payload); break;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isCatalogError = message.includes('Catalog Error');

    if (isCatalogError) {
      logger.warn(
        `[Worker] Transient table error (will auto-retry): ${message.split('\n')[0]}`
      );
    } else {
      logger.error('[Worker] Query failed:', error);
    }

    self.postMessage({ id, success: false, error: message });
  }
};
