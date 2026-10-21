/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

import { db } from '@/lib/db';
import { BASELINE_DDL, MIGRATIONS, POST_SCHEMA_STATEMENTS, SCHEMA_VERSION } from './db-schema';

let schemaPromise: Promise<void> | null = null;

async function getUserVersion(): Promise<number> {
  const rows = await db.$queryRawUnsafe('PRAGMA user_version') as Array<{ user_version: number }>;
  return rows[0]?.user_version ?? 0;
}

async function exec(statement: string): Promise<void> {
  await db.$executeRawUnsafe(statement);
}

/** PRAGMA statements may return result rows — always read them as a query. */
async function pragma(statement: string): Promise<void> {
  await db.$queryRawUnsafe(statement);
}

async function applySchema(): Promise<void> {
  // WAL journal: better crash-safety + concurrency for a desktop POS workload
  await pragma('PRAGMA journal_mode = WAL');

  const version = await getUserVersion();

  if (version <= 0) {
    // Fresh (or pre-versioning) database: apply the full idempotent baseline.
    // IF NOT EXISTS keeps this safe for databases created by `prisma db push`
    // during development (which never stamped user_version).
    for (const statement of BASELINE_DDL) {
      await exec(statement);
    }
    await pragma(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  } else if (version < SCHEMA_VERSION) {
    // Existing database behind the app: apply incremental migrations
    // sequentially, bumping the stamp after each step.
    for (let v = version; v < SCHEMA_VERSION; v++) {
      const statements = MIGRATIONS[v];
      if (!statements || statements.length === 0) {
        // No migration registered for this hop — jump the stamp (the baseline
        // IF NOT EXISTS pass below reconciles any structural drift safely).
        await pragma(`PRAGMA user_version = ${v + 1}`);
        continue;
      }
      for (const statement of statements) {
        await exec(statement);
      }
      await pragma(`PRAGMA user_version = ${v + 1}`);
    }
    // Reconcile structural drift idempotently (added tables/indexes)
    for (const statement of BASELINE_DDL) {
      await exec(statement);
    }
  }

  for (const statement of POST_SCHEMA_STATEMENTS) {
    await pragma(statement);
  }
}

/** Idempotent schema bootstrap — safe to call from every entry point. */
export function ensureDatabaseSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = applySchema().catch((e) => {
      // Allow a later retry (e.g. transient filesystem lock at boot)
      schemaPromise = null;
      throw e;
    });
  }
  return schemaPromise;
}
