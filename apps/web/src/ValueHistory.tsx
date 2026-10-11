'use client';
import { useState } from 'react';
import {
  formatMoney,
  valuationSeries,
  valuationChart,
  type Currency,
  type Valuation,
} from '@estate-atlas/shared';

export default function ValueHistory({
  values,
  currency: currentCurrency,
  period,
}: {
  values: Valuation[];
  currency: Currency;
  period?: 30 | 365 | null;
}) {
  const [currency, setCurrency] = useState(currentCurrency);
  const [days, setDays] = useState<30 | 365 | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const series = valuationSeries(values, currency, period === undefined ? days : period);
  const chart = valuationChart(series.points);
  const point = series.points.find((v) => v.id === selected) ?? series.last;
  const currencyOptions = [...new Set([currentCurrency, ...values.map((v) => v.currency)])];
  return (
    <section className="value-history" aria-label="Wertentwicklung">
      <div className="value-history-heading">
        <div>
          <p className="eyebrow">DEINE WERTE IM ZEITVERLAUF</p>
          <h3>Wertentwicklung</h3>
        </div>
        <select
          aria-label="Währung der Wertentwicklung"
          value={currency}
          onChange={(e) => {
            setCurrency(e.target.value as Currency);
            setSelected(null);
          }}
        >
          {currencyOptions.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      {period === undefined && (
        <div className="history-periods" aria-label="Zeitraum der Wertentwicklung">
          {(
            [
              { label: 'Gesamt', days: null },
              { label: '12 Monate', days: 365 },
              { label: '30 Tage', days: 30 },
            ] as const
          ).map((period) => (
            <button
              key={period.label}
              type="button"
              aria-pressed={days === period.days}
              onClick={() => {
                setDays(period.days);
                setSelected(null);
              }}
            >
              {period.label}
            </button>
          ))}
        </div>
      )}
      {!point ? (
        <p className="history-empty">
          In diesem Zeitraum wurden keine Werte in {currency} erfasst.
        </p>
      ) : (
        <>
          <div className="history-summary">
            <strong>{formatMoney(series.last!.marketValue, currency)}</strong>
            <span className={series.change !== null && series.change < 0 ? 'negative' : ''}>
              {series.change === null
                ? 'Ein erster Wert – noch kein Trend'
                : `${series.change >= 0 ? '+' : ''}${formatMoney(series.change, currency)}${series.changePercent === null ? '' : ` (${series.changePercent >= 0 ? '+' : ''}${series.changePercent.toLocaleString('de-AT', { maximumFractionDigits: 1 })} %)`} seit erster Angabe im Zeitraum`}
            </span>
          </div>
          <div className="history-axis">
            <span>Skala ab {formatMoney(chart.low, currency)}</span>
            <span>bis {formatMoney(chart.high, currency)}</span>
          </div>
          <svg
            className="value-chart"
            viewBox="0 0 600 184"
            role="img"
            aria-label={`Wertverlauf in ${currency}, ${series.points.length} gespeicherte Wertangaben`}
          >
            {[16, 92, 168].map((y) => (
              <line key={y} x1="12" x2="588" y1={y} y2={y} className="chart-grid" />
            ))}
            {chart.points.length > 1 && <path d={chart.path} className="chart-line" />}
            {chart.points.map((p) => (
              <circle
                key={p.value.id}
                cx={p.x}
                cy={p.y}
                r={p.value.id === point.id ? 7 : 4}
                className="chart-point"
                onMouseEnter={() => setSelected(p.value.id)}
                onClick={() => setSelected(p.value.id)}
              >
                <title>
                  {new Date(p.value.recordedAt).toLocaleString('de-AT')} ·{' '}
                  {formatMoney(p.value.marketValue, currency)}
                </title>
              </circle>
            ))}
          </svg>
          <div className="chart-dates">
            <span>{new Date(series.first!.recordedAt).toLocaleDateString('de-AT')}</span>
            <span>
              {series.points.length > 1
                ? new Date(series.last!.recordedAt).toLocaleDateString('de-AT')
                : ''}
            </span>
          </div>
          {series.points.length > 1 && (
            <input
              className="chart-slider"
              type="range"
              aria-label="Wertangabe auswählen"
              min={0}
              max={series.points.length - 1}
              value={series.points.findIndex((v) => v.id === point.id)}
              onChange={(e) => setSelected(series.points[Number(e.target.value)]!.id)}
            />
          )}
          <p className="chart-selection" aria-live="polite">
            {new Date(point.recordedAt).toLocaleString('de-AT')} ·{' '}
            <strong>{formatMoney(point.marketValue, currency)}</strong> ·{' '}
            {point.origin === 'analysis' ? 'KI-Recherche · von dir übernommen' : 'Eigene Angabe'}
          </p>
        </>
      )}
      <p className="muted">
        Gespeicherte eigene Angaben und übernommene Recherchewerte. Jede Währung bleibt getrennt;
        zwischen den Punkten wurden keine Werte erhoben.
      </p>
      <details className="history-records">
        <summary>Alle Wertangaben ansehen ({series.points.length})</summary>
        <div className="history">
          {series.points.map((v) => (
            <div key={v.id}>
              <span>{new Date(v.recordedAt).toLocaleString('de-AT')}</span>
              <strong>{formatMoney(v.marketValue, v.currency)}</strong>
              <span>
                {v.origin === 'analysis' ? 'KI-Recherche · von dir übernommen' : 'Eigene Angabe'}
              </span>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
