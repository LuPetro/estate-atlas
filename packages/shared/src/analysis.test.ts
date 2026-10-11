import { describe, it, expect } from 'vitest';
import { analysisInput, calculateAnalysis, selectComparables, sourceKey } from './analysis';
import { sampleProperties } from './index';
import { fixtureResearch } from '../../../tests/fixtures/analysis';
const input = analysisInput(sampleProperties[0]!);
const calculate = (
  research = fixtureResearch(input),
  urls = research.candidates.map((c) => c.url),
) => calculateAnalysis(input, research, urls);
describe('evidence-based comparison rules (synthetic fixtures)', () => {
  it('calculates the median locally and discloses asking-price uncertainty', () => {
    const r = calculate();
    expect(r.mid).toBe(Math.round((4050 * input.area) / 1000) * 1000);
    expect(r.low).toBeLessThan(r.mid);
    expect(r.high).toBeGreaterThan(r.mid);
    expect(r.basis).toBe('asking');
    expect(r.confidence).toBe('low');
    expect(r.uncertainties.join(' ')).toContain('keine nachgewiesenen Verkaufspreise');
  });
  it('does not send own values or private content in the research snapshot', () => {
    expect(input).not.toHaveProperty('marketValue');
    expect(input).not.toHaveProperty('purchasePrice');
    expect(input).not.toHaveProperty('notes');
    expect(input).not.toHaveProperty('title');
  });
  it.each(['currency', 'country', 'type', 'localMarket', 'area', 'publishedAt'] as const)(
    'rejects mismatching %s without a invented fallback',
    (field) => {
      const r = fixtureResearch(input);
      r.candidates = r.candidates.map((c) => ({
        ...c,
        [field]: (
          {
            currency: 'JPY',
            country: 'ZZ',
            type: 'land',
            localMarket: false,
            area: input.area * 5,
            publishedAt: '2020-01-01',
          } as Record<string, unknown>
        )[field],
      }));
      expect(() => calculate(r)).toThrow('Zu wenige');
    },
  );
  it('rejects uncited sources and duplicate links', () => {
    expect(() => calculate(undefined, [])).toThrow();
    const r = fixtureResearch(input);
    r.candidates = r.candidates.map((c) => ({ ...c, url: r.candidates[0]!.url }));
    expect(() => calculate(r)).toThrow();
  });
  it('requires two distinct websites', () => {
    const r = fixtureResearch(input);
    r.candidates = r.candidates.map((c, i) => ({ ...c, url: `https://example.org/item-${i}` }));
    expect(
      selectComparables(
        input,
        r,
        r.candidates.map((c) => c.url),
      ),
    ).toMatchObject({ websites: 1, exclusions: {} });
    expect(() => calculate(r)).toThrow('4 aus 1 Websites');
  });
  it('does not combine asking prices and transactions to reach the minimum', () => {
    const r = fixtureResearch(input);
    r.candidates = r.candidates.map((c, i) => ({ ...c, basis: i < 2 ? 'asking' : 'transaction' }));
    expect(() => calculate(r)).toThrow();
  });
  it('excludes an extreme outlier and undated transactions', () => {
    const r = fixtureResearch(input);
    r.candidates[3]!.price *= 20;
    expect(calculate(r).comparables).toHaveLength(3);
    r.candidates = r.candidates.map((c) => ({ ...c, basis: 'transaction', publishedAt: null }));
    expect(() => calculate(r)).toThrow();
  });
  it('allows undated active listings but states the limitation', () => {
    const r = fixtureResearch(input);
    r.candidates = r.candidates.map((c) => ({ ...c, publishedAt: null }));
    expect(calculate(r).uncertainties.join(' ')).toContain('Veröffentlichungsdatum unbekannt');
  });
  it('normalizes tracking links and rejects private or unsafe URLs', () => {
    expect(sourceKey('https://example.org/p?utm_source=a#top')).toBe('https://example.org/p');
    for (const u of [
      'http://example.org',
      'https://127.0.0.1/p',
      'https://user:pass@example.org',
      'file:///etc/passwd',
      'https://[::1]/',
    ])
      expect(sourceKey(u)).toBeNull();
  });
});

it('converts explicitly quoted square feet to m² without currency conversion', () => {
  const research = fixtureResearch(input);
  const reference = calculate(research);
  research.candidates = research.candidates.map((c) => ({
    ...c,
    area: c.area / 0.09290304,
    areaUnit: 'sqft',
  }));
  const result = calculate(research);
  expect(result.mid).toBe(reference.mid);
  expect(result.comparables[0]!.normalizedArea).toBeCloseTo(input.area, 8);
  expect(result.comparables[0]!.areaUnit).toBe('sqft');
});
