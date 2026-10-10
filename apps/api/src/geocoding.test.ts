import { describe, it, expect, vi } from 'vitest';
import { createGeocoder, photonResults } from './geocoding';

const feature = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [16.3738, 48.2082] },
  properties: {
    name: 'Synthetischer Testtreffer',
    street: 'Teststraße',
    housenumber: '1',
    postcode: '1010',
    city: 'Wien',
    country: 'Österreich',
    countrycode: 'at',
  },
};
const payload = { features: [feature] };
const response = () => new Response(JSON.stringify(payload));
describe('Photon geocoding boundary', () => {
  it('uses GeoJSON longitude first and preserves house number and ISO country', () => {
    expect(photonResults(payload)[0]).toEqual({
      label: 'Synthetischer Testtreffer · Teststraße 1, 1010 Wien, Österreich',
      address: 'Teststraße 1, 1010 Wien, Österreich',
      country: 'AT',
      latitude: 48.2082,
      longitude: 16.3738,
      precision: 'building',
    });
  });
  it('labels street and place results as approximate instead of claiming a house position', () => {
    const street = { ...feature, properties: { ...feature.properties, housenumber: undefined } };
    const place = {
      ...feature,
      properties: { countrycode: 'AT', country: 'Österreich', name: 'Wien' },
    };
    expect(photonResults({ features: [street, place] }).map((result) => result.precision)).toEqual([
      'street',
      'place',
    ]);
  });
  it('ignores invalid coordinates/countries, removes duplicates and allows empty results', () => {
    expect(
      photonResults({
        features: [
          feature,
          feature,
          { ...feature, geometry: { type: 'Point', coordinates: [16, 91] } },
          { ...feature, properties: { ...feature.properties, countrycode: 'AUT' } },
        ],
      }),
    ).toHaveLength(1);
    expect(photonResults({ features: [] })).toEqual([]);
    expect(() => photonResults({ error: 'bad response' })).toThrow('keine gültigen Daten');
  });
  it('caps results at five', () => {
    expect(
      photonResults({
        features: Array.from({ length: 8 }, (_, index) => ({
          ...feature,
          geometry: { type: 'Point', coordinates: [16 + index, 48] },
        })),
      }),
    ).toHaveLength(5);
  });
  it('sends only the search to a fixed configurable endpoint with timeout and attribution headers', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(response());
    await createGeocoder({ fetch: request })('Teststraße 1, Wien', 'private-user-id');
    const [url, options] = request.mock.calls[0];
    expect(new URL(String(url)).hostname).toBe('photon.komoot.io');
    expect(new URL(String(url)).searchParams.get('q')).toBe('Teststraße 1, Wien');
    expect(String(url)).not.toContain('private-user-id');
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(options?.redirect).toBe('error');
    expect(new Headers(options?.headers).get('user-agent')).toContain('EstateAtlas');
  });
  it('caches briefly per account and expires results', async () => {
    let clock = 10000;
    const request = vi.fn<typeof fetch>().mockImplementation(async () => response());
    const search = createGeocoder({ fetch: request, now: () => clock });
    await search('Wien', 'one');
    await search('WIEN', 'one');
    expect(request).toHaveBeenCalledTimes(1);
    clock += 1000;
    await search('Wien', 'two');
    expect(request).toHaveBeenCalledTimes(2);
    clock += 10 * 60000;
    await search('Wien', 'one');
    expect(request).toHaveBeenCalledTimes(3);
  });
  it('limits uncached provider requests to one per second and one at a time', async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async () => response());
    const search = createGeocoder({ fetch: request, now: () => 10000 });
    const first = search('Wien', 'one');
    await expect(search('Berlin', 'two')).rejects.toMatchObject({ statusCode: 429 });
    await first;
    await expect(search('Berlin', 'two')).rejects.toMatchObject({ statusCode: 429 });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('handles provider errors, timeouts and malformed JSON without leaking search text', async () => {
    for (const request of [
      vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 429 })),
      vi.fn<typeof fetch>().mockRejectedValue(new Error('Secret address in provider URL')),
      vi.fn<typeof fetch>().mockResolvedValue(new Response('not-json')),
    ]) {
      await expect(
        createGeocoder({ fetch: request })('Secret address', 'one'),
      ).rejects.toMatchObject({
        statusCode: 503,
        message: expect.not.stringContaining('Secret address'),
      });
    }
  });
});
