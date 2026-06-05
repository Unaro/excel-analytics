// app/actions/pg-compute.ts
'use server';

import { compileQuery } from '@/shared/lib/computation/lib/query-compiler';
import { ClientComputeParams } from '@/shared/lib/computation/lib/types';
import { createPgClient, PgConnectionConfig } from '@/shared/api/postgres/client';

/**
 * Server Action: выполняет SQL на PostgreSQL.
 * 
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