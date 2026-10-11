import type { Currency, Valuation } from './index';

// Recorded observations only: no interpolation, fabricated history or currency conversion.
export function valuationSeries(
  values: readonly Valuation[],
  currency: Currency,
  days: 30 | 365 | null = null,
  now = new Date(),
) {
  const cutoff = days === null ? -Infinity : now.getTime() - days * 86400000;
  const points = values
    .filter(
      (v) =>
        v.currency === currency &&
        Number.isFinite(v.marketValue) &&
        v.marketValue >= 0 &&
        Number.isFinite(Date.parse(v.recordedAt)) &&
        Date.parse(v.recordedAt) >= cutoff &&
        Date.parse(v.recordedAt) <= now.getTime(),
    )
    .sort(
      (a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt) || a.id.localeCompare(b.id),
    );
  const first = points[0],
    last = points.at(-1);
  const change =
    points.length > 1 ? Math.round((last!.marketValue - first!.marketValue) * 100) / 100 : null;
  return {
    points,
    first,
    last,
    change,
    changePercent:
      change !== null && first!.marketValue > 0 ? (change / first!.marketValue) * 100 : null,
  };
}

export function valuationChart(points: readonly Valuation[]) {
  if (!points.length) return { points: [], path: '', low: 0, high: 0 };
  const min = Math.min(...points.map((p) => p.marketValue)),
    max = Math.max(...points.map((p) => p.marketValue));
  const margin = Math.max((max - min) * 0.15, max * 0.02, 1);
  const low = Math.max(0, min - margin),
    high = max + margin;
  const start = Date.parse(points[0]!.recordedAt),
    end = Date.parse(points.at(-1)!.recordedAt);
  const plotted = points.map((p, i) => ({
    x:
      points.length === 1
        ? 300
        : 12 +
          576 *
            (end > start
              ? (Date.parse(p.recordedAt) - start) / (end - start)
              : i / (points.length - 1)),
    y: 16 + (152 * (high - p.marketValue)) / (high - low),
    value: p,
  }));
  return {
    points: plotted,
    path: plotted.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '),
    low,
    high,
  };
}
