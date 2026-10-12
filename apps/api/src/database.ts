import pg from 'pg';
import { readFile } from 'node:fs/promises';
import type { Property, Valuation, Asset, AnalysisJob } from '@estate-atlas/shared';
pg.types.setTypeParser(1700, Number);
export function database(connectionString: string) {
  return new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000 });
}
export async function migrate(pool: pg.Pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(428716025)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    for (const version of [
      '001_initial',
      '002_analysis',
      '003_analysis_diagnostics',
      '004_property_workspace',
    ]) {
      const previous = await client.query('SELECT 1 FROM schema_migrations WHERE version=$1', [
        version,
      ]);
      if (!previous.rowCount) {
        await client.query(
          await readFile(new URL(`../migrations/${version}.sql`, import.meta.url), 'utf8'),
        );
        await client.query('INSERT INTO schema_migrations(version) VALUES($1)', [version]);
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
const iso = (v: Date | string) => (v instanceof Date ? v.toISOString() : v);
export function toProperty(row: Record<string, any>): Property {
  return {
    ...row.data,
    rental: row.data.rental ?? null,
    id: row.id,
    ownerId: row.owner_id,
    access: row.access ?? 'owner',
    archivedAt: row.archived_at ? iso(row.archived_at) : null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}
export function toValuation(r: Record<string, any>): Valuation {
  return {
    id: r.id,
    propertyId: r.property_id,
    marketValue: Number(r.market_value),
    currency: r.currency,
    recordedAt: iso(r.recorded_at),
    origin: r.origin,
  };
}
export function toAsset(r: Record<string, any>): Asset {
  return {
    id: r.id,
    propertyId: r.property_id,
    name: r.name,
    mimeType: r.mime_type,
    size: r.size,
    createdAt: iso(r.created_at),
  };
}
export function toAnalysis(r: Record<string, any>): AnalysisJob {
  return {
    id: r.id,
    propertyId: r.property_id,
    status: r.status,
    requestedAt: iso(r.requested_at),
    reason: r.reason,
    result: r.result,
    diagnostics: r.diagnostics ?? null,
    phase: r.phase ?? 'queued',
    model: r.model ?? null,
    provider: r.provider ?? null,
    startedAt: r.started_at ? iso(r.started_at) : null,
    finishedAt: r.finished_at ? iso(r.finished_at) : null,
    appliedAt: r.applied_at ? iso(r.applied_at) : null,
  };
}
