'use client';

import { logger } from '@/shared/lib/logger';
import { useEffect, useState, useCallback } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { duckdbManager, type DuckDBEngineStatus } from '@/shared/lib/computation/lib/duckdb/manager';
import { get } from 'idb-keyval';

export interface EngineStatusState {
  /** Текущий статус движка */
  status: DuckDBEngineStatus;
  /** ID активного file-датасета (или null) */
  activeFileDatasetId: string | null;
  /** Попытка восстановить движок (reload из IDB) */
  reload: () => Promise<boolean>;
  /** true во время reload */
  isReloading: boolean;
}

/**
 * Отслеживает состояние DuckDB Worker'а в реальном времени.
 *
 * Для file-датасетов:
 *   'ready'        — Worker жив, SQL-запросы работают
 *   'disconnected' — Worker упал, нужна перезагрузка
 *   'loading'      — идёт восстановление
 *   'error'        — не удалось восстановить (нет Arrow buffer в IDB)
 *   'no-data'      — нет активных file-датасетов
 *
 * Для postgres-датасетов всегда возвращает 'ready'
 * (PG-запросы идут через Server Actions, Worker не нужен).
 *
 * Widget-level хук (зависит от entities/dataset).
 */
export function useEngineStatus(): EngineStatusState {
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  // Подписка ТОЛЬКО на sourceType (примитив), а не на весь объект датасета:
  // иначе любое обновление активного датасета (rows/metadata/pgStatus —
  // например, каскад восстановления при гидрации) перерисовывает всех
  // потребителей хука (Sidebar), хотя им нужен лишь тип источника.
  const sourceType = useDatasetStore(s =>
    (activeDatasetId ? s.datasets[activeDatasetId]?.sourceType : undefined) ?? 'file'
  );
  // Статус восстановления активного датасета (его ставит гидрация-restore):
  // нужен, чтобы провал restore ('error') не превращался в вечный лоадер.
  const activeEngineStatus = useDatasetStore(s =>
    activeDatasetId ? s.datasets[activeDatasetId]?.engineStatus : undefined
  );
  // Существует ли активный датасет реально (id мог остаться от удалённого/
  // сброшенного — тогда это «нет данных», а не «грузим»).
  const activeDatasetExists = useDatasetStore(s =>
    activeDatasetId ? !!s.datasets[activeDatasetId] : false
  );

  const [status, setStatus] = useState<DuckDBEngineStatus>(duckdbManager.status);
  const [isReloading, setIsReloading] = useState(false);

  // Гидрация dataset-стора (persist из IndexedDB) асинхронна: до её завершения
  // activeDatasetId ещё null, а статус движка — дефолтный 'no-data'. Чтобы не
  // мигать терминальной заглушкой «Нет данных», ждём гидрацию.
  //
  // ВАЖНО: стартуем строго с false на ЛЮБОМ первом рендере (и сервер, и клиент).
  // hasHydrated() в инициализаторе вернул бы разные значения на сервере (false)
  // и клиенте (часто true — стор успел гидрироваться) → гидрационный мисматч
  // (сайдбар рисует <a> на сервере и <div> на клиенте). Проверку выносим в
  // эффект (после монтирования), там же закрываем гонку «check-then-subscribe»:
  // если гидрация уже завершилась между рендером и эффектом, onFinishHydration
  // (одноразовый) больше не сработает — поэтому сперва проверяем hasHydrated().
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (useDatasetStore.persist?.hasHydrated?.() ?? true) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- разовая синхронизация SSR-флага после монтирования
      setHydrated(true);
      return;
    }
    return useDatasetStore.persist?.onFinishHydration?.(() => setHydrated(true));
  }, []);

  // Подписка на изменения статуса
  useEffect(() => {
    if (sourceType !== 'file') {
      setStatus('ready');
      return;
    }

    const unsubscribe = duckdbManager.subscribe(setStatus);

    // При монтировании — ping для актуального статуса
    duckdbManager.ping().then(result => {
      if (!result) {
        setStatus('disconnected');
      } else if (!result.dbInitialized) {
        setStatus('loading');
      } else {
        setStatus('ready');
      }
    });

    return unsubscribe;
  }, [sourceType]);

  const reload = useCallback(async (): Promise<boolean> => {
    if (sourceType !== 'file' || !activeDatasetId) {
      return true;
    }

    setIsReloading(true);
    try {
      const arrowBuffer = await get<Uint8Array>(`arrow:${activeDatasetId}`);

      if (!(arrowBuffer instanceof Uint8Array) || arrowBuffer.byteLength === 0) {
        logger.error('[useEngineStatus] No Arrow buffer in IDB for', activeDatasetId);
        setStatus('error');
        return false;
      }

      const success = await duckdbManager.ensureReady(activeDatasetId, arrowBuffer);
      return success;
    } catch (err) {
      logger.error('[useEngineStatus] Reload failed:', err);
      setStatus('error');
      return false;
    } finally {
      setIsReloading(false);
    }
  }, [sourceType, activeDatasetId]);

  // Эффективный статус: 'no-data' от менеджера НЕ означает «нет данных», пока
  // стор гидрируется или есть активный file-датасет (движок лениво/через
  // restore ещё загружает его в воркер; registerArrowBuffer затем ставит
  // 'ready'). В этих случаях показываем loading, а не терминальную заглушку.
  const effectiveStatus: DuckDBEngineStatus =
    sourceType !== 'file'
      ? 'ready'
      : !hydrated
        ? 'loading'
        : status !== 'no-data'
          ? status // менеджер знает реальный статус (ready/loading/disconnected/error)
          : !activeDatasetId || !activeDatasetExists
            ? 'no-data' // нет активного датасета (или он удалён/сброшен)
            : activeEngineStatus === 'error'
              ? 'error' // restore активного датасета провалился
              : 'loading'; // данные есть, движок ещё восстанавливает

  return {
    status: effectiveStatus,
    activeFileDatasetId: sourceType === 'file' ? activeDatasetId : null,
    reload,
    isReloading,
  };
}