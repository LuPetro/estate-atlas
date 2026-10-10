import { z } from 'zod';
import { geocodingResultSchema, type GeocodingResult } from '@estate-atlas/shared';

export class GeocodingError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
const text = z.string().trim().max(400).optional();
const featureSchema = z.object({
  geometry: z.object({
    type: z.literal('Point'),
    // GeoJSON uses longitude first.
    coordinates: z.tuple([
      z.number().finite().min(-180).max(180),
      z.number().finite().min(-90).max(90),
    ]),
  }),
  properties: z.object({
    name: text,
    street: text,
    housenumber: text,
    postcode: text,
    city: text,
    locality: text,
    district: text,
    state: text,
    country: text,
    countrycode: z.string().regex(/^[a-zA-Z]{2}$/),
  }),
});
export function photonResults(payload: unknown): GeocodingResult[] {
  const collection = z.object({ features: z.array(z.unknown()).max(100) }).safeParse(payload);
  if (!collection.success)
    throw new GeocodingError(503, 'Die Adresssuche liefert gerade keine gültigen Daten.');
  const results: GeocodingResult[] = [];
  const seen = new Set<string>();
  for (const raw of collection.data.features) {
    const feature = featureSchema.safeParse(raw);
    if (!feature.success) continue;
    const p = feature.data.properties;
    const street = [p.street, p.housenumber].filter(Boolean).join(' ');
    const city = [p.postcode, p.city ?? p.locality ?? p.district ?? p.state]
      .filter(Boolean)
      .join(' ');
    const address = [...new Set([street || p.name, city, p.country].filter(Boolean))].join(', ');
    const label = p.name && !address.includes(p.name) ? `${p.name} · ${address}` : address;
    const result = geocodingResultSchema.safeParse({
      label,
      address,
      country: p.countrycode.toUpperCase(),
      longitude: feature.data.geometry.coordinates[0],
      latitude: feature.data.geometry.coordinates[1],
      precision: p.street && p.housenumber ? 'building' : p.street ? 'street' : 'place',
    });
    if (!result.success) continue;
    const key = `${result.data.country}:${result.data.address}:${result.data.latitude}:${result.data.longitude}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(result.data);
    if (results.length === 5) break;
  }
  return results;
}

export function createGeocoder(
  options: {
    url?: string;
    fetch?: typeof fetch;
    now?: () => number;
  } = {},
) {
  const endpoint = new URL(options.url ?? 'https://photon.komoot.io/api/');
  if (!['https:', 'http:'].includes(endpoint.protocol) || endpoint.username || endpoint.password)
    throw new Error('GEOCODING_URL muss eine HTTP(S)-Adresse ohne Zugangsdaten sein.');
  const request = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const cache = new Map<string, { expires: number; results: GeocodingResult[] }>();
  let lastRequest = -Infinity;
  let inFlight = false;
  return async (query: string, userId: string): Promise<GeocodingResult[]> => {
    const key = `${userId}:${query.toLocaleLowerCase('de')}`;
    const cached = cache.get(key);
    if (cached && cached.expires > now()) return cached.results;
    if (inFlight || now() - lastRequest < 1000)
      throw new GeocodingError(
        429,
        'Adresssuche ist kurz ausgelastet. Bitte nach einer Sekunde erneut suchen.',
      );
    inFlight = true;
    lastRequest = now();
    try {
      const url = new URL(endpoint);
      url.searchParams.set('q', query);
      url.searchParams.set('limit', '5');
      url.searchParams.set('lang', 'de');
      const response = await request(url, {
        signal: AbortSignal.timeout(8000),
        redirect: 'error',
        headers: {
          'User-Agent': 'EstateAtlas/0.1 (https://github.com/LuPetro/estate-atlas)',
          Accept: 'application/json',
        },
      });
      if (!response.ok)
        throw new GeocodingError(
          503,
          'Adresssuche gerade nicht erreichbar. Du kannst den Pin auf der Karte setzen.',
        );
      const body = await response.text();
      if (body.length > 256 * 1024) throw new Error('Response too large');
      const results = photonResults(JSON.parse(body));
      for (const [entry, value] of cache) if (value.expires <= now()) cache.delete(entry);
      if (cache.size >= 200) cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: now() + 10 * 60000, results });
      return results;
    } catch (error) {
      if (error instanceof GeocodingError) throw error;
      // Do not include provider URLs/search text in logs or client errors.
      throw new GeocodingError(
        503,
        'Adresssuche gerade nicht erreichbar. Du kannst den Pin auf der Karte setzen.',
      );
    } finally {
      inFlight = false;
    }
  };
}
