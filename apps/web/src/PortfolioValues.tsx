'use client';
import { useEffect, useState } from 'react';
import type { ApiClient } from '@estate-atlas/api-client';
import {
  valueRows,
  portfolioStats,
  formatMoney,
  rentalSummary,
  type Property,
  type Valuation,
} from '@estate-atlas/shared';
import ValueHistory from './ValueHistory';

export default function PortfolioValues({
  properties,
  revision,
  api,
  onSelect,
}: {
  properties: Property[];
  revision: string;
  api: ApiClient;
  onSelect: (id: string) => void;
}) {
  const [values, setValues] = useState<Valuation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [propertyId, setPropertyId] = useState('');
  const [period, setPeriod] = useState<30 | 365 | null>(null);
  const [sort, setSort] = useState('name');
  const [archived, setArchived] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setValues([]);
    api
      .valuations(controller.signal)
      .then((v) => {
        if (!controller.signal.aborted) setValues(v);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, revision, refresh]);
  const items = properties.filter(
    (p) => (!propertyId || p.id === propertyId) && (archived || !p.archivedAt),
  );
  const rows = valueRows(items, values, period, sort);
  // Archived records can be inspected, but never count toward current totals.
  const stats = portfolioStats(items);
  return (
    <section className="portfolio-values" aria-label="Portfolio-Wertentwicklung">
      <div className="portfolio-toolbar">
        <select
          aria-label="Einzelne Immobilie"
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
        >
          <option value="">Alle ausgewählten Immobilien</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <select
          aria-label="Zeitraum für alle Immobilien"
          value={period ?? 'all'}
          onChange={(e) =>
            setPeriod(e.target.value === 'all' ? null : (Number(e.target.value) as 30 | 365))
          }
        >
          <option value="all">Gesamter Verlauf</option>
          <option value="365">12 Monate</option>
          <option value="30">30 Tage</option>
        </select>
        <select
          aria-label="Wertentwicklung sortieren"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="name">Nach Name</option>
          <option value="change">Entwicklung in %</option>
          <option value="recent">Zuletzt bewertet</option>
        </select>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />{' '}
          Archiv einblenden
        </label>
      </div>
      <div className="portfolio-totals">
        {stats.byCurrency.map((s) => (
          <article className="panel" key={s.currency}>
            <span>Aktueller Bestand · {s.currency}</span>
            <strong>{formatMoney(s.marketValue, s.currency)}</strong>
            <small>{s.count} aktive Immobilien · aktuelle gespeicherte Werte</small>
          </article>
        ))}
      </div>
      <p className="muted">
        {items.length} Immobilien in deiner Auswahl. Verläufe zeigen gespeicherte Wertangaben je
        Objekt; keine rückwirkende Gesamtbewertung. Archivobjekte zählen nicht zu den Summen. Der
        Zeitraum gilt für die Verläufe.
      </p>
      {loading ? (
        <p role="status">Wertangaben werden geladen …</p>
      ) : error ? (
        <div role="alert" className="error">
          {error}{' '}
          <button className="text-button" onClick={() => setRefresh((v) => v + 1)}>
            Erneut laden
          </button>
        </div>
      ) : !items.length ? (
        <p className="empty-state">Keine Immobilien passen zu dieser Auswahl.</p>
      ) : (
        <div className="portfolio-history-grid">
          {rows.map((row) => (
            <article className="panel portfolio-history-card" key={row.property.id}>
              <div className="panel-heading">
                <div>
                  <h2>{row.property.title}</h2>
                  <p>{row.property.address}</p>
                </div>
                <button className="text-button" onClick={() => onSelect(row.property.id)}>
                  Details öffnen ↗
                </button>
              </div>
              <p className="muted">
                {row.property.isTestData ? 'TESTDATEN · ' : ''}
                {row.property.archivedAt ? 'Archiv · ' : ''}
                {rentalSummary(row.property.rental).label}
              </p>
              <ValueHistory
                key={`${row.property.id}-${row.property.currency}`}
                values={row.history}
                currency={row.property.currency}
                period={period}
              />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
