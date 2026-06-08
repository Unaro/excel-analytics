// shared/lib/services/index.ts
// ─────────────────────────────────────────────────────────────
// Barrel-экспорт application-level сервисов.
//
// Эти сервисы:
//   - НЕ зависят от Zustand-сторов
//   - Принимают данные через параметры
//   - Тестируемы изолированно
//   - Могут использоваться из features/, widgets/ и app/
// ─────────────────────────────────────────────────────────────

export {
  buildConfigExportPayload,
  type ConfigExportContext,
  type ConfigExportPayload,
  type ConfigExportResult,
} from './config-export-service';

export {
  processConfigImport,
  ConfigImportError,
  type ConfigImportContext,
  type ConfigImportResult,
} from './config-import-service';