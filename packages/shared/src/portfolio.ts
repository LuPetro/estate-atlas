import { z } from 'zod';
import type { Property, Valuation } from './index';
import { valuationSeries } from './valuation';

export const dashboardWidgets = ['metrics', 'map', 'insights', 'properties'] as const;
export type DashboardWidget = (typeof dashboardWidgets)[number];
export const dashboardWidgetLabels: Record<DashboardWidget, string> = {
  metrics: 'Kennzahlen',
  map: 'Karte',
  insights: 'Werte & Verteilung',
  properties: 'Immobilienliste',
};
export const dashboardPreferencesSchema = z
  .object({
    metrics: z.boolean(),
    map: z.boolean(),
    insights: z.boolean(),
    properties: z.boolean(),
  })
  .strict();

// One comparison per property, always within one currency and selected period.
// A missing observation or a zero baseline never becomes a made-up return.
export function valueRows(
  properties: readonly Property[],
  values: readonly Valuation[],
  days: 30 | 365 | null = null,
  sort = 'name',
  now = new Date(),
) {
  const grouped = new Map<string, Valuation[]>();
  for (const v of values) {
    const history = grouped.get(v.propertyId) ?? [];
    history.push(v);
    grouped.set(v.propertyId, history);
  }
  const rows = properties.map((property) => {
    const history = grouped.get(property.id) ?? [];
    return { property, history, ...valuationSeries(history, property.currency, days, now) };
  });
  return rows.sort((a, b) => {
    if (sort === 'change') {
      if (a.changePercent === null && b.changePercent !== null) return 1;
      if (b.changePercent === null && a.changePercent !== null) return -1;
      const difference = (b.changePercent ?? 0) - (a.changePercent ?? 0);
      if (difference) return difference;
    }
    if (sort === 'recent') {
      const difference =
        Date.parse(b.last?.recordedAt ?? '') - Date.parse(a.last?.recordedAt ?? '');
      if (Number.isFinite(difference) && difference) return difference;
      if (!a.last && b.last) return 1;
      if (!b.last && a.last) return -1;
    }
    return (
      a.property.title.localeCompare(b.property.title, 'de') ||
      a.property.id.localeCompare(b.property.id)
    );
  });
}
