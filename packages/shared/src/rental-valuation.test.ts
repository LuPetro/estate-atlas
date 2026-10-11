import { expect, it } from 'vitest';
import {
  propertyInputSchema,
  sampleProperties,
  rentalSummary,
  valuationSeries,
  valuationChart,
  type Valuation,
} from './index';
import { analysisInput } from './analysis';

it('preserves unknown rental status for legacy properties and excludes tenancy from research input', () => {
  const { rental: _rental, ...legacy } = sampleProperties[0]!;
  expect(propertyInputSchema.parse(legacy).rental).toBeNull();
  const input = propertyInputSchema.parse({
    ...legacy,
    rental: { status: 'rented', start: '2026-01-01', end: null },
  });
  expect(analysisInput(input)).not.toHaveProperty('rental');
});
it('validates rental dates, vacant state and rejects reversed intervals', () => {
  for (const rental of [
    { status: 'rented', start: '2026-02-30', end: null },
    { status: 'rented', start: '2026-10-11', end: '2026-10-10' },
    { status: 'vacant', start: '2026-01-01', end: null },
    { status: 'rented', start: '', end: null },
  ])
    expect(propertyInputSchema.safeParse({ ...sampleProperties[0], rental }).success).toBe(false);
  expect(
    propertyInputSchema.parse({
      ...sampleProperties[0],
      rental: { status: 'rented', start: '2026-10-11', end: '2026-10-11' },
    }).rental?.end,
  ).toBe('2026-10-11');
});
it('distinguishes unspecified, vacant, future, ongoing and expired rental periods, including end day', () => {
  const now = new Date('2026-10-11T12:00:00Z');
  expect(rentalSummary(null, now).label).toBe('Vermietung nicht angegeben');
  expect(rentalSummary({ status: 'vacant', start: null, end: null }, now).label).toBe(
    'Nicht vermietet',
  );
  expect(rentalSummary({ status: 'rented', start: '2026-10-12', end: null }, now).label).toBe(
    'Vermietung geplant',
  );
  expect(
    rentalSummary({ status: 'rented', start: '2026-01-01', end: '2026-10-11' }, now).label,
  ).toBe('Vermietet');
  expect(
    rentalSummary({ status: 'rented', start: '2026-01-01', end: '2026-10-10' }, now).label,
  ).toBe('Mietzeitraum beendet');
  expect(rentalSummary({ status: 'rented', start: '2026-01-01', end: null }, now).period).toContain(
    'unbefristet',
  );
});
const value = (
  id: string,
  date: string,
  marketValue: number,
  currency: Valuation['currency'] = 'EUR',
): Valuation => ({
  id,
  propertyId: 'fixture',
  recordedAt: date,
  marketValue,
  currency,
  origin: 'user',
});
const now = new Date('2026-10-11T12:00:00Z');
it('sorts real value history, separates currencies and computes change from actual recorded observations', () => {
  const points = [
    value('c', '2026-10-10T10:00:00Z', 120),
    value('d', '2026-10-10T10:00:00Z', 900, 'USD'),
    value('a', '2025-01-01T10:00:00Z', 100),
    value('b', '2026-09-20T10:00:00Z', 110),
  ];
  const all = valuationSeries(points, 'EUR', null, now);
  expect(all.points.map((v) => v.id)).toEqual(['a', 'b', 'c']);
  expect(all.change).toBe(20);
  expect(all.changePercent).toBe(20);
  expect(valuationSeries(points, 'EUR', 30, now).change).toBe(10);
  expect(valuationSeries(points, 'USD', null, now).change).toBeNull();
  expect(valuationSeries(points, 'JPY', null, now).points).toEqual([]);
});
it('handles missing, zero, flat and simultaneous values without fabricated percentages or invalid plot coordinates', () => {
  expect(
    valuationSeries(
      [value('a', '2026-10-10T10:00:00Z', 0), value('b', '2026-10-10T10:00:00Z', 50)],
      'EUR',
      null,
      now,
    ).changePercent,
  ).toBeNull();
  expect(valuationChart([]).path).toBe('');
  const points = [value('a', '2026-10-10T10:00:00Z', 0), value('b', '2026-10-10T10:00:00Z', 0)];
  const chart = valuationChart(points);
  expect(chart.points.map((p) => p.x)).toEqual([12, 588]);
  expect(chart.points.every((p) => Number.isFinite(p.y))).toBe(true);
  expect(valuationChart([points[0]!]).points[0]!.x).toBe(300);
});
