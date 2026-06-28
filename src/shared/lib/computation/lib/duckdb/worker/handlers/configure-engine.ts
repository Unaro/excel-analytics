/// <reference lib="webworker" />

import { setEngineConfig, applyEngineConfig } from '../runtime';
import type { ConfigureEnginePayload } from '../messages';

/** CONFIGURE_ENGINE — настройки память↔время (memory_limit). */
export async function handleConfigureEngine(id: number, payload: ConfigureEnginePayload): Promise<void> {
  setEngineConfig(payload);
  await applyEngineConfig();
  self.postMessage({ id, success: true });
}
