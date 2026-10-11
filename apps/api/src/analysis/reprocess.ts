import type pg from 'pg';
import { analysisInput, calculateAnalysis, EvidenceError } from '@estate-atlas/shared/analysis';
import { toAnalysis } from '../database';
import { validateResearchExtraction } from './provider';
import { researchDiagnostics } from './evaluation';

// Administrative repair of a recent failed job, using its existing paid report.
// No provider call, new reservation, property write or automatic value adoption.
export async function reprocessAnalysis(pool: pg.Pool, id: string, ownerId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const job = (
      await client.query(
        'SELECT a.*,p.data,p.archived_at FROM analysis_jobs a JOIN properties p ON p.id=a.property_id WHERE a.id=$1 AND p.owner_id=$2 FOR UPDATE OF a,p',
        [id, ownerId],
      )
    ).rows[0];
    if (!job) throw new Error('Auftrag nicht gefunden.');
    if (
      job.status !== 'failed' ||
      job.applied_at ||
      !job.finished_at ||
      Date.now() - new Date(job.finished_at).getTime() > 86400000 ||
      !job.research?.report ||
      !job.research?.extracted
    )
      throw new Error(
        'Nur aktuelle fehlgeschlagene Aufträge mit gespeicherten Belegen können neu geprüft werden.',
      );
    if (
      job.archived_at ||
      job.data.isTestData ||
      JSON.stringify(analysisInput(job.data)) !== JSON.stringify(analysisInput(job.input))
    )
      throw new Error('Die Objektangaben haben sich geändert.');
    const validated = validateResearchExtraction(
      job.research.report,
      job.research.extracted,
      job.research.consultedUrls,
      true,
    );
    const report = { ...validated, consultedUrls: job.research.consultedUrls };
    const researchedAt = new Date(job.finished_at);
    const diagnostics = researchDiagnostics(job.input, report, researchedAt);
    let result = null,
      reason = null;
    try {
      result = calculateAnalysis(job.input, report.research, report.consultedUrls, researchedAt);
    } catch (error) {
      if (error instanceof EvidenceError) reason = error.message;
      else throw error;
    }
    const artifact = {
      ...job.research,
      research: report.research,
      reprocessing: job.research.reprocessing ?? {
        at: new Date().toISOString(),
        originalDiagnostics: job.diagnostics,
        originalReason: job.reason,
      },
    };
    const { rows } = await client.query(
      'UPDATE analysis_jobs SET status=$2,phase=$3,result=$4,reason=$5,diagnostics=$6,research=$7,updated_at=now() WHERE id=$1 RETURNING *',
      [
        id,
        result ? 'succeeded' : 'failed',
        result ? 'done' : 'calculating',
        result,
        reason,
        diagnostics,
        artifact,
      ],
    );
    await client.query('COMMIT');
    return toAnalysis(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
