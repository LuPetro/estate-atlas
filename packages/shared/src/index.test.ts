import { describe, it, expect } from 'vitest';
import {
  propertyInputSchema,
  sampleProperties,
  portfolioStats,
  filterProperties,
  clusterProperties,
  type Property,
} from './index';
const property = (i: number, extra: Partial<Property> = {}): Property => ({
  ...sampleProperties[i],
  id: `property-${i}`,
  ownerId: 'owner',
  archivedAt: null,
  createdAt: '2026-10-10T00:00:00Z',
  updatedAt: '2026-10-10T00:00:00Z',
  ...extra,
});
describe('property validation and portfolio business rules', () => {
  it('validates labeled sample data', () => {
    for (const sample of sampleProperties)
      expect(propertyInputSchema.parse(sample).isTestData).toBe(true);
  });
  it.each([
    { latitude: 91 },
    { longitude: -181 },
    { area: 0 },
    { marketValue: -1 },
    { purchasePrice: 1.005 },
    { country: 'Austria' },
    { currency: 'XXX' },
    { yearBuilt: 500 },
    { ownerId: 'attacker' },
  ])('rejects invalid input %j', (invalid) => {
    expect(propertyInputSchema.safeParse({ ...sampleProperties[0], ...invalid }).success).toBe(
      false,
    );
  });
  it('rejects fractional yen values', () =>
    expect(
      propertyInputSchema.safeParse({ ...sampleProperties[0], currency: 'JPY', marketValue: 1.5 })
        .success,
    ).toBe(false));
  it('normalizes country codes', () =>
    expect(propertyInputSchema.parse({ ...sampleProperties[0], country: 'at' }).country).toBe(
      'AT',
    ));
  it('keeps currency totals separate and excludes archive', () => {
    const stats = portfolioStats([
      property(0),
      property(1, { archivedAt: '2026-01-01' }),
      property(3),
    ]);
    expect(stats.count).toBe(2);
    expect(stats.byCurrency).toEqual([
      expect.objectContaining({ currency: 'EUR', marketValue: 375000 }),
      expect.objectContaining({ currency: 'USD', marketValue: 790000 }),
    ]);
  });
  it('does not fabricate a percentage when purchase price is zero', () =>
    expect(
      portfolioStats([property(0, { purchasePrice: 0 })]).byCurrency[0].gainPercent,
    ).toBeNull());
  it('sums currency amounts in minor units', () =>
    expect(
      portfolioStats([property(0, { marketValue: 0.1 }), property(1, { marketValue: 0.2 })])
        .byCurrency[0].marketValue,
    ).toBe(0.3));
  it('combines case-insensitive query, country, type and archive filters', () => {
    const items = [
      property(0),
      property(1),
      property(3),
      property(2, { archivedAt: '2026-01-01' }),
    ];
    expect(filterProperties(items, { query: 'WIEN', country: 'AT', type: 'apartment' })).toEqual([
      items[0],
    ]);
    expect(filterProperties(items, { archived: true })).toEqual([items[3]]);
  });
  it('clusters nearby native markers and splits them when zoomed in', () => {
    const items = [property(0), property(1, { latitude: 48.2083, longitude: 16.3739 })];
    expect(clusterProperties(items, 2)).toHaveLength(1);
    expect(clusterProperties(items, 24)).toHaveLength(2);
  });
});
