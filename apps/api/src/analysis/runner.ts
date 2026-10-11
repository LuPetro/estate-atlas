import type pg from 'pg';
import {
  analysisInput,
  calculateAnalysis,
  selectComparables,
  sourceKey,
  EvidenceError,
  type AnalysisJob,
} from '@estate-atlas/shared/analysis';
import { ResearchError, type AnalysisRuntime } from './provider';
export class AnalysisRunner {
  private controller: AbortController | null = null;
  constructor(
    private pool: pg.Pool,
    private runtime: AnalysisRuntime,
  ) {}
  stop() {
    this.controller?.abort();
  }
  async tick() {
    if (!this.runtime.config.enabled || !this.runtime.provider) return false;
    // Never retry an interrupted paid call automatically.
    await this.pool.query(
      "UPDATE analysis_jobs SET status='failed',finished_at=now(),reason='Worker wurde unterbrochen. Bitte eine neue Recherche ausdrücklich starten.' WHERE status='running' AND updated_at<now()-interval '60 seconds'",
    );
    const { rows } = await this.pool.query(
      `UPDATE analysis_jobs SET status='running',started_at=now(),updated_at=now(),phase='researching' WHERE id=(SELECT id FROM analysis_jobs WHERE status='queued' ORDER BY requested_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
    );
    const job = rows[0];
    if (!job) return false;
    const controller = (this.controller = new AbortController());
    const deadline = setTimeout(() => controller.abort(), 180000);
    const heartbeat = setInterval(() => {
      void this.pool
        .query(
          "UPDATE analysis_jobs SET updated_at=now() WHERE id=$1 AND status='running' RETURNING id",
          [job.id],
        )
        .then((r) => {
          if (!r.rowCount) controller.abort();
        })
        .catch(() => controller.abort());
    }, 10000);
    const phase = async (value: AnalysisJob['phase']) => {
      controller.signal.throwIfAborted();
      const r = await this.pool.query(
        "UPDATE analysis_jobs SET phase=$2,updated_at=now() WHERE id=$1 AND status='running' RETURNING id",
        [job.id, value],
      );
      if (!r.rowCount) {
        controller.abort();
        controller.signal.throwIfAborted();
      }
    };
    try {
      const property = (
        await this.pool.query('SELECT data,archived_at FROM properties WHERE id=$1', [
          job.property_id,
        ])
      ).rows[0];
      if (
        !property ||
        property.archived_at ||
        property.data.isTestData ||
        JSON.stringify(analysisInput(property.data)) !== JSON.stringify(analysisInput(job.input))
      )
        throw new ResearchError(
          'Objektangaben haben sich geändert oder die Immobilie wurde archiviert. Bitte eine neue Analyse starten.',
        );
      if (
        !this.runtime.config.models.includes(job.model) ||
        job.provider !== this.runtime.provider.id
      )
        throw new ResearchError('Das angeforderte Modell ist nicht mehr aktiviert.');
      const report = await this.runtime.provider.research(
        job.input,
        job.model,
        controller.signal,
        phase,
      );
      await phase('calculating');
      const selection = selectComparables(job.input, report.research, report.consultedUrls);
      const exclusions = { ...report.checks?.exclusions };
      for (const [key, count] of Object.entries(selection.exclusions)) {
        const reason = key as keyof typeof exclusions;
        exclusions[reason] = (exclusions[reason] ?? 0) + count!;
      }
      const diagnostics = {
        extracted: report.checks?.extracted ?? report.research.candidates.length,
        verified: report.research.candidates.length,
        accepted: selection.comparables.length,
        websites: selection.websites,
        sources: report.consultedUrls.filter((url) => sourceKey(url)).slice(0, 80),
        exclusions,
        notes: report.research.uncertainties,
      };
      // Save evidence and usage before calculation, including insufficient samples.
      controller.signal.throwIfAborted();
      await this.pool.query(
        "UPDATE analysis_jobs SET diagnostics=$2,research=$3,usage=$4,updated_at=now() WHERE id=$1 AND status='running'",
        [
          job.id,
          diagnostics,
          { ...report.artifact, research: report.research, consultedUrls: report.consultedUrls },
          report.usage,
        ],
      );
      const result = calculateAnalysis(job.input, report.research, report.consultedUrls);
      controller.signal.throwIfAborted();
      await this.pool.query(
        "UPDATE analysis_jobs SET status='succeeded',phase='done',result=$2,usage=$3,reason=NULL,finished_at=now(),updated_at=now() WHERE id=$1 AND status='running'",
        [job.id, result, report.usage],
      );
    } catch (e) {
      const reason =
        e instanceof ResearchError || e instanceof EvidenceError
          ? e.message
          : controller.signal.aborted
            ? 'Recherche abgebrochen oder Zeitlimit erreicht. Es wurde kein Wert geschätzt.'
            : 'Recherche konnte nicht sicher abgeschlossen werden. Es wurde kein Wert geschätzt.';
      await this.pool.query(
        "UPDATE analysis_jobs SET status='failed',reason=$2,finished_at=now(),updated_at=now() WHERE id=$1 AND status='running'",
        [job.id, reason],
      );
    } finally {
      clearTimeout(deadline);
      clearInterval(heartbeat);
      this.controller = null;
    }
    return true;
  }
}
