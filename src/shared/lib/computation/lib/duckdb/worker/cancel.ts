// Отмена COMPUTE-задач: менеджер шлёт CANCEL (AbortSignal в хуках), пока тяжёлый
// SQL исполняется во внутреннем воркере duckdb-wasm и наш event loop свободен.
// Контрольные точки в обработчике COMPUTE прерывают задачу между этапами.

const cancelledComputeIds = new Set<number>();

export function markCancelled(targetId: number): void {
  // CANCEL для уже завершённой задачи оставил бы запись навсегда —
  // страхуемся от неограниченного роста.
  if (cancelledComputeIds.size > 500) cancelledComputeIds.clear();
  cancelledComputeIds.add(targetId);
}

/** true — задача была отменена; запись при этом снимается (одноразово). */
export function takeCancelled(id: number): boolean {
  if (!cancelledComputeIds.has(id)) return false;
  cancelledComputeIds.delete(id);
  return true;
}
