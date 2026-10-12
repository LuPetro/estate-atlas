import type { Currency, Property } from './index';
import { countryNames } from './countries';
import { rentalSummary } from './rental';

export type DistributionGrouping = 'country' | 'type' | 'rental';
export type DistributionMetric = 'value' | 'count' | 'area';
const typeLabels: Record<Property['type'], string> = {
  apartment: 'Wohnung',
  house: 'Haus',
  commercial: 'Gewerbe',
  land: 'Grundstück',
};

/** Currency selection applies to every metric, so switching metrics preserves the cohort. */
export function portfolioDistribution(
  properties: readonly Property[],
  currency: Currency,
  groupBy: DistributionGrouping = 'country',
  metric: DistributionMetric = 'value',
  now = new Date(),
) {
  const items = properties.filter((p) => !p.archivedAt && p.currency === currency);
  const groups = new Map<
    string,
    { key: string; label: string; value: number; share: number; count: number }
  >();
  const today = now.toISOString().slice(0, 10);
  for (const p of items) {
    let key: string, label: string;
    if (groupBy === 'country') {
      key = p.country;
      label = countryNames[p.country]?.at(-1) ?? p.country;
    } else if (groupBy === 'type') {
      key = p.type;
      label = typeLabels[p.type];
    } else {
      key = !p.rental
        ? 'unknown'
        : p.rental.status === 'vacant'
          ? 'vacant'
          : p.rental.start > today
            ? 'planned'
            : p.rental.end && p.rental.end < today
              ? 'ended'
              : 'rented';
      label = rentalSummary(p.rental, now).label;
    }
    const group = groups.get(key) ?? { key, label, value: 0, share: 0, count: 0 };
    // Aggregate money in minor units; no exchange rates or currency conversion.
    group.value +=
      metric === 'value' ? Math.round(p.marketValue * 100) : metric === 'area' ? p.area : 1;
    group.count++;
    groups.set(key, group);
  }
  const rows = [...groups.values()];
  const totalUnits = rows.reduce((sum, row) => sum + row.value, 0);
  for (const row of rows) {
    row.share = totalUnits > 0 ? (row.value / totalUnits) * 100 : 0;
    if (metric === 'value') row.value /= 100;
  }
  rows.sort(
    (a, b) =>
      b.value - a.value || a.label.localeCompare(b.label, 'de') || a.key.localeCompare(b.key),
  );
  return {
    total: metric === 'value' ? totalUnits / 100 : totalUnits,
    count: items.length,
    groups: rows,
  };
}
