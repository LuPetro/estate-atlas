'use client';
import { useState } from 'react';
import { PieChart, ArrowUpRight } from 'lucide-react';
import {
  portfolioDistribution,
  formatMoney,
  type Currency,
  type Property,
} from '@estate-atlas/shared';

const colors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
];
export default function PortfolioDistribution({
  properties,
  onSelect,
}: {
  properties: Property[];
  onSelect: (id: string) => void;
}) {
  const [groupBy, setGroupBy] = useState<'country' | 'type' | 'rental'>('country');
  const [metric, setMetric] = useState<'value' | 'count' | 'area'>('value');
  const [selectedCurrency, setCurrency] = useState<Currency>('EUR');
  const currencies = [
    ...new Set(properties.filter((p) => !p.archivedAt).map((p) => p.currency)),
  ].sort();
  const currency = currencies.includes(selectedCurrency)
    ? selectedCurrency
    : (currencies[0] ?? 'EUR');
  const distribution = portfolioDistribution(properties, currency, groupBy, metric);
  const money = (value: number) =>
    metric === 'value'
      ? formatMoney(value, currency)
      : `${value.toLocaleString('de-AT', { maximumFractionDigits: 1 })}${metric === 'area' ? ' m²' : ''}`;
  let offset = 0;
  const stops = distribution.groups
    .map((group, index) => {
      const start = offset;
      offset += group.share;
      return `${colors[index % colors.length]} ${start}% ${offset}%`;
    })
    .join(', ');
  return (
    <section aria-label="Portfolio-Verteilung" className="distribution-page">
      <div className="portfolio-toolbar">
        <label>
          Gruppieren nach
          <select
            aria-label="Verteilung gruppieren"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
          >
            <option value="country">Land</option>
            <option value="type">Immobilienart</option>
            <option value="rental">Vermietung</option>
          </select>
        </label>
        <label>
          Vergleichen nach
          <select
            aria-label="Verteilungskennzahl"
            value={metric}
            onChange={(e) => setMetric(e.target.value as typeof metric)}
          >
            <option value="value">Marktwert</option>
            <option value="count">Anzahl</option>
            <option value="area">Fläche</option>
          </select>
        </label>
        <label>
          Währungsgruppe
          <select
            aria-label="Verteilungswährung"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
          >
            {(currencies.length ? currencies : ['EUR']).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      {!distribution.count ? (
        <div className="empty-state">
          <PieChart size={32} />
          <h3>Noch keine Verteilung</h3>
          <p>Füge eine Immobilie hinzu oder passe deine Filter an.</p>
        </div>
      ) : (
        <div className="allocation-layout">
          <article className="panel allocation-chart">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">ZUSAMMENSETZUNG</p>
                <h2>Wo deine Werte liegen</h2>
              </div>
              <PieChart size={20} />
            </div>
            <div
              className="allocation-ring"
              role="img"
              aria-label={`Gesamt ${money(distribution.total)}, ${distribution.count} Immobilien. Aufteilung in der folgenden Tabelle.`}
              style={{
                background: distribution.total > 0 ? `conic-gradient(${stops})` : '#e2e5e1',
              }}
            >
              <div>
                <small>
                  {metric === 'value' ? 'Marktwert' : metric === 'area' ? 'Fläche' : 'Immobilien'} ·{' '}
                  {currency}
                </small>
                <strong>{money(distribution.total)}</strong>
                <span>{distribution.count} Immobilien</span>
              </div>
            </div>
            <p className="muted">
              Die Auswahl enthält ausschließlich aktive Immobilien in {currency}. Andere Währungen
              werden separat betrachtet.
            </p>
          </article>
          <article className="panel allocation-breakdown">
            <div className="panel-heading">
              <div>
                <h2>Im Detail</h2>
                <p>
                  {groupBy === 'country'
                    ? 'Verteilung nach Ländern'
                    : groupBy === 'type'
                      ? 'Verteilung nach Immobilienarten'
                      : 'Verteilung nach Vermietung'}
                </p>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Gruppe</th>
                  <th>
                    {metric === 'value' ? 'Marktwert' : metric === 'area' ? 'Fläche' : 'Anzahl'}
                  </th>
                  <th>Anteil</th>
                </tr>
              </thead>
              <tbody>
                {distribution.groups.map((g, i) => (
                  <tr key={g.key}>
                    <td>
                      <span
                        className="allocation-swatch"
                        style={{ background: colors[i % colors.length] }}
                      />
                      {g.label}
                      <small>
                        {g.count} {g.count === 1 ? 'Immobilie' : 'Immobilien'}
                      </small>
                    </td>
                    <td>{money(g.value)}</td>
                    <td>
                      <strong>
                        {g.share.toLocaleString('de-AT', { maximumFractionDigits: 1 })} %
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted">
              Anteile beschreiben deinen aktuellen Bestand. Sie sind keine Risikobewertung.
            </p>
          </article>
        </div>
      )}
      <div className="distribution-property-list">
        <div className="section-heading">
          <h2>Immobilien in dieser Währungsgruppe</h2>
          <span className="counter">{distribution.count}</span>
        </div>
        {properties
          .filter((p) => !p.archivedAt && p.currency === currency)
          .map((p) => (
            <button key={p.id} className="workspace-object-row" onClick={() => onSelect(p.id)}>
              <span>
                <strong>{p.title}</strong>
                <small>{p.address}</small>
              </span>
              <strong>{formatMoney(p.marketValue, p.currency)}</strong>
              <ArrowUpRight size={17} />
            </button>
          ))}
      </div>
    </section>
  );
}
