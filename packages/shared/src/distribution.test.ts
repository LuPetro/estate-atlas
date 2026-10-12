import { expect, it } from 'vitest';
import { portfolioDistribution } from './distribution';
import { sampleProperties, type Property } from './index';
const now = new Date('2026-10-11T12:00:00Z');
const property = (id: string, overrides: Partial<Property> = {}): Property => ({
  ...sampleProperties[0]!,
  id,
  ownerId: 'isolated-test-owner',
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  archivedAt: null,
  ...overrides,
});
it('partitions selected-currency values and excludes archived property values', () => {
  const items = [
    property('a', { marketValue: 0.1 }),
    property('b', { marketValue: 0.2 }),
    property('c', { country: 'DE', marketValue: 0.7 }),
    property('d', { currency: 'USD', marketValue: 99999 }),
    property('e', { archivedAt: now.toISOString(), marketValue: 99999 }),
  ];
  const result = portfolioDistribution(items, 'EUR', 'country');
  expect(result.total).toBe(1);
  expect(result.count).toBe(3);
  expect(result.groups).toEqual([
    { key: 'DE', label: 'Deutschland', value: 0.7, share: 70, count: 1 },
    { key: 'AT', label: 'Österreich', value: 0.3, share: 30, count: 2 },
  ]);
  expect(portfolioDistribution(items, 'USD', 'country').total).toBe(99999);
});
it('keeps count and area cohorts consistent with currency, without interpreting them as money', () => {
  const items = [
    property('a', { type: 'house', area: 50 }),
    property('b', { area: 150 }),
    property('c', { area: 999, currency: 'USD' }),
  ];
  const count = portfolioDistribution(items, 'EUR', 'type', 'count');
  expect(count.total).toBe(2);
  expect(count.groups.every((g) => g.share === 50)).toBe(true);
  const area = portfolioDistribution(items, 'EUR', 'type', 'area');
  expect(area.total).toBe(200);
  expect(area.groups[0]).toMatchObject({ key: 'apartment', value: 150, share: 75 });
});
it('distinguishes unknown, vacant, planned, current and ended rental periods', () => {
  const items = [
    property('a', { rental: null }),
    property('b', { rental: { status: 'vacant', start: null, end: null } }),
    property('c', { rental: { status: 'rented', start: '2027-01-01', end: null } }),
    property('d', { rental: { status: 'rented', start: '2025-01-01', end: '2026-10-11' } }),
    property('e', { rental: { status: 'rented', start: '2025-01-01', end: '2026-10-10' } }),
  ];
  const result = portfolioDistribution(items, 'EUR', 'rental', 'count', now);
  expect(new Set(result.groups.map((g) => g.key))).toEqual(
    new Set(['unknown', 'vacant', 'planned', 'rented', 'ended']),
  );
  expect(result.groups.every((g) => g.share === 20 && g.count === 1)).toBe(true);
});
it('returns an honest empty or zero-value distribution without NaN percentages', () => {
  expect(portfolioDistribution([], 'EUR')).toEqual({ total: 0, count: 0, groups: [] });
  const result = portfolioDistribution([property('a', { marketValue: 0 })], 'EUR');
  expect(result.total).toBe(0);
  expect(result.groups[0]).toMatchObject({ value: 0, share: 0, count: 1 });
});
