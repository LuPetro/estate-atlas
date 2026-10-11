import { z } from 'zod';
import { currencies, propertyTypes, conditions, type PropertyInput } from './index';

// Only these object attributes may leave the server. No account, notes, files or own prices.
export function analysisInput(p: PropertyInput) {
  return {
    address: p.address,
    country: p.country,
    latitude: p.latitude,
    longitude: p.longitude,
    type: p.type,
    area: p.area,
    currency: p.currency,
    condition: p.condition,
    yearBuilt: p.yearBuilt,
    amenities: p.amenities,
  };
}
export type AnalysisInput = ReturnType<typeof analysisInput>;
export const candidateSchema = z
  .object({
    title: z.string().min(1).max(300),
    url: z.string().url().max(2000),
    evidence: z.string().min(10).max(2000),
    price: z.number().finite().positive().max(1e12),
    area: z.number().finite().positive().max(1e8),
    areaUnit: z.enum(['m2', 'sqft']),
    currency: z.enum(currencies),
    country: z.string().regex(/^[A-Z]{2}$/),
    type: z.enum(propertyTypes),
    condition: z.enum(conditions).nullable(),
    localMarket: z.boolean(),
    active: z.boolean(),
    publishedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    basis: z.enum(['asking', 'transaction']),
  })
  .strict();
export const researchSchema = z
  .object({
    candidates: z.array(candidateSchema).max(20),
    uncertainties: z.array(z.string().max(1000)).max(12),
  })
  .strict();
export type Candidate = z.infer<typeof candidateSchema>;
export type Research = z.infer<typeof researchSchema>;
export type AnalysisResult = {
  low: number;
  mid: number;
  high: number;
  currency: AnalysisInput['currency'];
  researchedAt: string;
  pricePerSqm: number;
  method: 'median-comparables-v1';
  basis: 'asking' | 'transaction';
  confidence: 'low' | 'medium';
  sources: { url: string; title: string; retrievedAt: string }[];
  comparables: (Candidate & { normalizedArea: number })[];
  uncertainties: string[];
  reasoning: string;
};
export type AnalysisJob = {
  id: string;
  propertyId: string;
  status: 'blocked' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  phase: 'queued' | 'researching' | 'extracting' | 'calculating' | 'done';
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  appliedAt: string | null;
  model: string | null;
  provider: string | null;
  reason: string | null;
  result: AnalysisResult | null;
};
export type AnalysisConfig = {
  enabled: boolean;
  reason: string | null;
  models: string[];
  defaultModel: string;
};
export const analysisPhases = [
  { id: 'queued', label: 'Auftrag wird gestartet' },
  { id: 'researching', label: 'Aktuelle Angebote recherchieren' },
  { id: 'extracting', label: 'Vergleichsobjekte prüfen' },
  { id: 'calculating', label: 'Preisspanne berechnen' },
  { id: 'done', label: 'Recherche abgeschlossen' },
] as const;
export class EvidenceError extends Error {}
export function sourceKey(value: string) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password) return null;
    // Public source links only. These links are never fetched by our backend.
    if (
      !u.hostname.includes('.') ||
      /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
        u.hostname,
      ) ||
      u.hostname.startsWith('[')
    )
      return null;
    u.hash = '';
    for (const key of [...u.searchParams.keys()])
      if (/^(utm_|fbclid$|gclid$)/.test(key)) u.searchParams.delete(key);
    u.searchParams.sort();
    return u.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}
const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return (s[Math.floor((s.length - 1) / 2)]! + s[Math.floor(s.length / 2)]!) / 2;
};
export function calculateAnalysis(
  input: AnalysisInput,
  research: Research,
  consultedUrls: string[],
  now = new Date(),
): AnalysisResult {
  const known = new Set(consultedUrls.map(sourceKey).filter(Boolean));
  const seen = new Set<string>();
  const eligible = research.candidates
    .map((c) => ({ ...c, normalizedArea: c.areaUnit === 'sqft' ? c.area * 0.09290304 : c.area }))
    .filter((c) => {
      const key = sourceKey(c.url);
      const age =
        c.publishedAt === null ? null : (now.getTime() - Date.parse(c.publishedAt)) / 86400000;
      if (
        !key ||
        !known.has(key) ||
        seen.has(key) ||
        c.currency !== input.currency ||
        c.country !== input.country ||
        c.type !== input.type ||
        (input.type !== 'land' && c.condition !== null && c.condition !== input.condition) ||
        !c.localMarket ||
        c.normalizedArea / input.area < 0.5 ||
        c.normalizedArea / input.area > 2 ||
        (c.basis === 'asking' && !c.active) ||
        (age !== null && (!Number.isFinite(age) || age < -1 || age > 180)) ||
        (c.basis === 'transaction' && age === null)
      )
        return false;
      seen.add(key);
      return true;
    });
  // Do not mix advertised prices with completed transactions.
  const transactions = eligible.filter((c) => c.basis === 'transaction');
  const basis = transactions.length >= 3 ? 'transaction' : 'asking';
  const group = eligible.filter((c) => c.basis === basis);
  const center = group.length ? median(group.map((c) => c.price / c.normalizedArea)) : 0;
  const comparables = group.filter(
    (c) => c.price / c.normalizedArea >= center / 2 && c.price / c.normalizedArea <= center * 2,
  );
  if (
    comparables.length < 3 ||
    new Set(comparables.map((c) => new URL(c.url).hostname.replace(/^www\./, ''))).size < 2
  )
    throw new EvidenceError(
      'Zu wenige passende Vergleichsobjekte: mindestens drei aus zwei unterschiedlichen Websites in derselben Lage, Objektart und Währung sind erforderlich. Es wurde kein Wert geschätzt.',
    );
  const prices = comparables.map((c) => c.price / c.normalizedArea).sort((a, b) => a - b);
  const pricePerSqm = median(prices);
  const raw = pricePerSqm * input.area;
  const unit = raw >= 100000 ? 1000 : raw >= 10000 ? 100 : 1;
  const round = (n: number) => Math.round(n / unit) * unit;
  const spread = basis === 'asking' ? 0.15 : 0.1;
  const low = round(
    Math.min(prices[Math.floor((prices.length - 1) * 0.25)]! * input.area, raw * (1 - spread)),
  );
  const high = round(
    Math.max(prices[Math.ceil((prices.length - 1) * 0.75)]! * input.area, raw * (1 + spread)),
  );
  if (high > 1e12)
    throw new EvidenceError(
      'Die recherchierte Preisspanne überschreitet den unterstützten Wertebereich.',
    );
  const uncertainties = [
    ...research.uncertainties,
    'Die Angaben wurden von KI aus recherchierten Webinhalten extrahiert. Preise, Lage und Objektmerkmale bitte anhand der Quellen prüfen. Unterschiedliche Websites können dasselbe Objekt anbieten.',
    'Die Spanne ist eine Vergleichspreis-Indikation, kein Gutachten oder statistisches Konfidenzintervall. Zustand, Baurecht und individuelle Besonderheiten können erheblich abweichen.',
    ...(basis === 'asking'
      ? [
          'Angebotspreise sind keine nachgewiesenen Verkaufspreise. Verhandlungsspielraum wurde nicht geschätzt.',
        ]
      : []),
    ...(comparables.some((c) => !c.publishedAt)
      ? [
          'Bei einzelnen Angeboten ist das Veröffentlichungsdatum unbekannt. Die Aktualität lässt sich dort nicht sicher bestätigen.',
        ]
      : []),
  ];
  return {
    low,
    mid: round(raw),
    high,
    currency: input.currency,
    researchedAt: now.toISOString(),
    pricePerSqm: Math.round(pricePerSqm * 100) / 100,
    method: 'median-comparables-v1',
    basis,
    confidence:
      comparables.length >= 6 &&
      comparables.every((c) => c.condition === input.condition && c.publishedAt)
        ? 'medium'
        : 'low',
    comparables,
    sources: comparables.map((c) => ({
      url: c.url,
      title: c.title,
      retrievedAt: now.toISOString(),
    })),
    uncertainties: [...new Set(uncertainties)],
    reasoning: `Median der Quadratmeterpreise von ${comparables.length} Vergleichsobjekten × ${input.area} m². Spanne aus Quartilen mit mindestens ±${spread * 100} %. Keine erfundenen Zu- oder Abschläge.`,
  };
}
