import { expect, it } from 'vitest';
import {
  sampleProperties,
  filterProperties,
  valueRows,
  portfolioStats,
  dashboardPreferencesSchema,
  type Property,
  type Valuation,
} from './index';
const now = new Date('2026-10-11T12:00:00Z');
const properties: Property[] = sampleProperties.map((p, i) => ({
  ...p,
  id: `p${i}`,
  ownerId: 'isolated-fixture',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  archivedAt: null,
}));
const value = (
  id: string,
  propertyId: string,
  marketValue: number,
  currency: Valuation['currency'],
  recordedAt: string,
): Valuation => ({ id, propertyId, marketValue, currency, recordedAt, origin: 'user' });
it('combines portfolio filters and keeps unknown, vacant and contractual rental states distinct', () => {
  const items = properties.map((p, i) => ({
    ...p,
    rental:
      i === 0
        ? { status: 'rented' as const, start: '2027-01-01', end: null }
        : i === 1
          ? { status: 'vacant' as const, start: null, end: null }
          : null,
  }));
  expect(
    filterProperties(items, {
      country: 'AT',
      type: 'apartment',
      rental: 'rented',
      currency: 'EUR',
      query: ' wien ',
    }).map((p) => p.id),
  ).toEqual(['p0']);
  expect(filterProperties(items, { rental: 'vacant' }).map((p) => p.id)).toEqual(['p1']);
  expect(filterProperties(items, { rental: 'unknown' }).map((p) => p.id)).toEqual(['p2', 'p3']);
  expect(filterProperties(items, { currency: 'USD', propertyId: 'p0' })).toEqual([]);
  const archived = { ...items[0]!, archivedAt: now.toISOString() };
  expect(filterProperties([archived], {})).toEqual([]);
  expect(filterProperties([archived], { archived: true })).toEqual([archived]);
  expect(portfolioStats([archived]).byCurrency).toEqual([]);
});
it('compares actual histories per property without mixing currencies, missing values or zero baselines', () => {
  const values = [
    value('a', 'p0', 100, 'EUR', '2026-01-01T00:00:00Z'),
    value('b', 'p0', 125, 'EUR', '2026-10-10T00:00:00Z'),
    value('c', 'p0', 900, 'USD', '2026-10-11T00:00:00Z'),
    value('d', 'p1', 0, 'EUR', '2026-01-01T00:00:00Z'),
    value('e', 'p1', 200, 'EUR', '2026-10-09T00:00:00Z'),
    value('f', 'foreign', 999, 'EUR', '2026-10-11T00:00:00Z'),
  ];
  const rows = valueRows(properties, values, null, 'change', now);
  expect(rows[0]!.property.id).toBe('p0');
  expect(rows[0]!.changePercent).toBe(25);
  expect(rows.find((r) => r.property.id === 'p1')!.changePercent).toBeNull();
  expect(rows.find((r) => r.property.id === 'p2')!.last).toBeUndefined();
  expect(rows.find((r) => r.property.id === 'p0')!.points.map((v) => v.id)).toEqual(['a', 'b']);
  expect(valueRows(properties, values, 30, 'name', now).every((r) => r.change === null)).toBe(true);
  expect(valueRows(properties, values, null, 'recent', now)[0]!.property.id).toBe('p0');
});
it('rejects malformed device preferences instead of hiding the entire dashboard', () => {
  expect(dashboardPreferencesSchema.safeParse({ metrics: true }).success).toBe(false);
  expect(
    dashboardPreferencesSchema.safeParse({
      metrics: 'false',
      map: true,
      insights: true,
      properties: true,
    }).success,
  ).toBe(false);
  expect(
    dashboardPreferencesSchema.parse({
      metrics: true,
      map: false,
      insights: true,
      properties: false,
    }).map,
  ).toBe(false);
});
