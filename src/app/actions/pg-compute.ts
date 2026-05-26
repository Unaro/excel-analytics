'use server';

import { compileQuery } from '@/features/computation/lib/query-compiler';
import type { ClientComputeParams } from '@/features/computation/lib/types';
import { createPgClient, type PgConnectionConfig } from '@/shared/api/postgres/client';

/**
 * Server Action: выполняет SQL, скомпилированный на клиенте.
 */
export async function computePgMetrics(
  params: ClientComputeParams,
  decryptedConfig: PgConnectionConfig
) {
  const { sql, params: queryParams } = compileQuery(params, 'postgres');
  const client = createPgClient(decryptedConfig);
  try {
    const rows = await client.unsafe(sql, queryParams);
    return { success: true, rows };
  } finally {
    await client.end({ timeout: 2 }).catch(() => {});
  }
}