'use client';
import { useEffect, useState } from 'react';
import { Sparkles, Search, Check, ExternalLink, ArrowUpRight } from 'lucide-react';
import { formatMoney, type PropertyDetail, type AnalysisJob } from '@estate-atlas/shared';
import {
  analysisPhases,
  exclusionLabels,
  type Exclusions,
  type AnalysisConfig,
} from '@estate-atlas/shared/analysis';
import type { ApiClient } from '@estate-atlas/api-client';
const active = (j: AnalysisJob | null) => j?.status === 'queued' || j?.status === 'running';
export default function AnalysisPanel({
  property,
  api,
  onApplied,
}: {
  property: PropertyDetail;
  api: ApiClient;
  onApplied: () => Promise<void>;
}) {
  const [config, setConfig] = useState<AnalysisConfig | null>(null);
  const [job, setJob] = useState<AnalysisJob | null>(property.analyses[0] ?? null);
  const [model, setModel] = useState('');
  const [setupOpen, setSetupOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let live = true;
    api
      .analysisConfig()
      .then((c) => {
        if (live) {
          setConfig(c);
          setModel(c.defaultModel);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [api]);
  useEffect(() => {
    setJob(property.analyses[0] ?? null);
  }, [property.analyses]);
  const running = active(job);
  useEffect(() => {
    if (!running || !job) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const poll = async () => {
      try {
        if (!document.hidden) {
          const next = await api.analysis(
            job.id,
            AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
          );
          if (!live) return;
          setJob(next);
          setError('');
          if (!active(next)) return;
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      }
      if (live) timer = setTimeout(poll, 2000);
    };
    timer = setTimeout(poll, 1000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      live = false;
      controller.abort();
      clearTimeout(timer);
      clearInterval(clock);
    };
  }, [running, job?.id, api]);
  const action = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const result = job?.status === 'succeeded' ? job.result : null;
  const phaseIndex = analysisPhases.findIndex((p) => p.id === job?.phase);
  const seconds = job?.startedAt
    ? Math.max(0, Math.floor((now - Date.parse(job.startedAt)) / 1000))
    : 0;
  return (
    <section className={`ai-panel ${running ? 'ai-active' : ''}`} aria-labelledby="ai-heading">
      <div className="ai-header">
        <div className="ai-orb" aria-hidden="true">
          <Sparkles size={18} />
        </div>
        <div>
          <p className="eyebrow">ESTATEATLAS RESEARCH</p>
          <h3 id="ai-heading">Marktpreis recherchieren</h3>
          <p>Webquellen recherchieren, Vergleichsangebote prüfen und eine Preisspanne ableiten.</p>
        </div>
      </div>
      {!running && config?.enabled && (
        <button
          type="button"
          className="button secondary ai-prepare"
          aria-expanded={setupOpen}
          onClick={() => setSetupOpen(!setupOpen)}
        >
          {setupOpen
            ? 'Einstellungen schließen'
            : result
              ? 'Neue Recherche vorbereiten'
              : 'Recherche vorbereiten'}
        </button>
      )}
      {running ? (
        <>
          <div className="ai-live" role="status">
            <span className="ai-dot" />
            {analysisPhases[phaseIndex]?.label ?? 'Recherche läuft'}
            <span>{seconds > 0 ? `${seconds} s` : 'In Warteschlange'}</span>
          </div>
          <ol className="ai-steps">
            {analysisPhases.slice(0, 4).map((p, i) => (
              <li
                key={p.id}
                className={i < phaseIndex ? 'complete' : i === phaseIndex ? 'current' : ''}
              >
                <span>{i < phaseIndex ? <Check size={14} /> : i + 1}</span>
                {p.label}
              </li>
            ))}
          </ol>
          <p className="ai-note">
            Die Schritte zeigen den tatsächlichen Serverstatus. Dein eigener Wert bleibt bis zur
            Übernahme erhalten.
          </p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              action(async () => {
                setJob(await api.cancelAnalysis(job!.id));
              })
            }
          >
            Recherche abbrechen
          </button>
        </>
      ) : (
        (setupOpen || !config?.enabled) && (
          <>
            <div className="ai-controls">
              <label>
                Recherchemodell
                <select
                  aria-label="Recherchemodell"
                  value={model}
                  disabled={!config?.enabled || busy}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {(config?.models ?? ['gpt-6-luna']).map((m) => (
                    <option key={m} value={m}>
                      {m === 'gpt-6-luna' ? 'GPT-6 Luna · Sparsam' : m}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!config?.enabled && (
              <p className="ai-notice">
                {config?.reason ?? 'Recherchekonfiguration wird geladen …'}
              </p>
            )}
            {(property.isTestData || property.archivedAt) && (
              <p className="ai-notice">Recherche ist nur für aktive, reale Immobilien verfügbar.</p>
            )}
            {config?.enabled && (
              <label className="ai-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                Ich stimme zu, dass Adresse, Position und Objektmerkmale für diese Recherche an
                OpenAI und dessen Suchdienste übermittelt werden. API-Kosten fallen an.
              </label>
            )}
            <button
              className="button primary ai-start"
              disabled={
                busy ||
                !config?.enabled ||
                !consent ||
                property.isTestData ||
                Boolean(property.archivedAt)
              }
              onClick={() =>
                action(async () => {
                  setJob(await api.analyse(property.id, { model, consent: true }));
                  setSetupOpen(false);
                })
              }
            >
              <Search size={17} />
              {busy
                ? 'Bitte warten …'
                : result
                  ? 'Erneut recherchieren'
                  : 'Marktpreis recherchieren'}
              <ArrowUpRight size={18} />
            </button>
          </>
        )
      )}
      {!running && job?.reason && (
        <p className="analysis-status ai-note" role="status">
          {job.reason}
        </p>
      )}
      {!running && job?.diagnostics && job.status === 'failed' && (
        <details className="ai-evidence">
          <summary>Was hat die Recherche gefunden?</summary>
          <p className="ai-note">
            {job.diagnostics.extracted} Angebote ausgelesen · {job.diagnostics.verified} mit Preis-
            und Flächenbeleg · {job.diagnostics.accepted} passend aus {job.diagnostics.websites}{' '}
            Websites
          </p>
          {Object.entries(job.diagnostics.exclusions).map(([reason, count]) => (
            <p className="ai-note" key={reason}>
              {count} × {exclusionLabels[reason as keyof Exclusions]}
            </p>
          ))}
          {job.diagnostics.notes.map((note, i) => (
            <p className="ai-note" key={i}>
              {note}
            </p>
          ))}
          <p className="ai-note">
            Recherchierte Quellen; darunter können Übersichtsseiten und unpassende Angebote sein:
          </p>
          {job.diagnostics.sources.map((url) => (
            <p key={url}>
              <a href={url} target="_blank" rel="noopener noreferrer">
                {new URL(url).hostname} · Quelle öffnen ↗
              </a>
            </p>
          ))}
        </details>
      )}
      {result && (
        <div className="ai-result">
          <div className="ai-result-heading">
            <span>Recherchierte Preisindikation</span>
            <span className="ai-badge">
              {result.confidence === 'medium' ? 'Mittlere' : 'Geringe'} Datensicherheit
            </span>
          </div>
          <strong className="ai-price">{formatMoney(result.mid, result.currency)}</strong>
          <p className="ai-range">
            {formatMoney(result.low, result.currency)} – {formatMoney(result.high, result.currency)}
          </p>
          <p className="ai-note">
            {result.basis === 'asking' ? 'Angebotspreise' : 'Dokumentierte Transaktionen'} ·{' '}
            {result.comparables.length} Vergleichsobjekte ·{' '}
            {formatMoney(result.pricePerSqm, result.currency)}/m² ·{' '}
            {new Date(result.researchedAt).toLocaleDateString('de-AT')}
          </p>
          <p className="ai-note">{result.reasoning}</p>
          <details className="ai-evidence">
            <summary>Vergleichsobjekte & Quellen ansehen</summary>
            <div className="ai-comparables">
              {result.comparables.map((c) => (
                <article key={c.url}>
                  <a href={c.url} target="_blank" rel="noopener noreferrer">
                    {c.title}
                    <ExternalLink size={13} />
                  </a>
                  <strong>
                    {formatMoney(c.price, c.currency)} ·{' '}
                    {c.normalizedArea.toLocaleString('de-AT', { maximumFractionDigits: 2 })} m²
                  </strong>
                  <small>{c.publishedAt ?? 'Veröffentlichungsdatum unbekannt'}</small>
                  <p>{c.evidence}</p>
                </article>
              ))}
            </div>
          </details>
          <details className="ai-evidence">
            <summary>Unsicherheiten & Berechnung</summary>
            <ul>
              {result.uncertainties.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </details>
          <button
            className="button secondary"
            disabled={busy || Boolean(job?.appliedAt)}
            onClick={() =>
              action(async () => {
                setJob(await api.applyAnalysis(job!.id));
                await onApplied();
              })
            }
          >
            <Check size={16} />
            {job?.appliedAt ? 'Wert übernommen' : 'Geprüften Wert übernehmen'}
          </button>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
