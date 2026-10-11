import { z } from 'zod';
import { countryCodeSchema } from './countries';
export { countryCodeSchema, countryCodes, countryNames, countryFromEvidence } from './countries';
export const currencies = ['EUR', 'USD', 'GBP', 'CHF', 'AED', 'CAD', 'AUD', 'JPY'] as const;
export const propertyTypes = ['apartment', 'house', 'commercial', 'land'] as const;
export const conditions = ['new', 'good', 'renovation'] as const;
export const propertyTypeLabels: Record<PropertyType, string> = {
  apartment: 'Wohnung',
  house: 'Haus',
  commercial: 'Gewerbe',
  land: 'Grundstück',
};
export const conditionLabels = { new: 'Neuwertig', good: 'Gut', renovation: 'Sanierungsbedarf' };
export { rentalSchema, rentalSummary } from './rental';
export { valuationSeries, valuationChart } from './valuation';
export {
  dashboardWidgets,
  dashboardWidgetLabels,
  dashboardPreferencesSchema,
  valueRows,
} from './portfolio';
export type { DashboardWidget } from './portfolio';
import { rentalSchema } from './rental';
const money = z
  .number()
  .finite()
  .min(0)
  .max(1e12)
  .refine(
    (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.001,
    'Höchstens zwei Nachkommastellen',
  );
export const propertyInputSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    address: z.string().trim().min(3).max(300),
    country: z
      .string()
      .trim()
      .length(2)
      .transform((v) => v.toUpperCase())
      .pipe(countryCodeSchema),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    type: z.enum(propertyTypes),
    purchasePrice: money,
    marketValue: money,
    currency: z.enum(currencies),
    area: z.number().finite().positive().max(1e8),
    yearBuilt: z
      .number()
      .int()
      .min(1000)
      .max(new Date().getFullYear() + 5)
      .nullable()
      .default(null),
    amenities: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    condition: z.enum(conditions).default('good'),
    notes: z.string().trim().max(5000).default(''),
    rental: rentalSchema.nullable().default(null),
    isTestData: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.currency === 'JPY')
      for (const field of ['purchasePrice', 'marketValue'] as const) {
        if (!Number.isInteger(value[field]))
          context.addIssue({
            code: 'custom',
            path: [field],
            message: 'JPY-Beträge müssen ganzzahlig sein.',
          });
      }
  });
export const credentialsSchema = z
  .object({
    email: z.email().trim().toLowerCase().max(254),
    password: z.string().min(12, 'Mindestens 12 Zeichen').max(128),
  })
  .strict();
export const registerSchema = credentialsSchema.extend({ name: z.string().trim().min(2).max(80) });
export const archiveSchema = z.object({ archived: z.boolean() }).strict();
export const geocodingQuerySchema = z.object({ query: z.string().trim().min(4).max(300) }).strict();
export const geocodingResultSchema = z.object({
  label: z.string().min(1).max(400),
  address: z.string().min(3).max(300),
  country: countryCodeSchema,
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  precision: z.enum(['building', 'street', 'place']),
});
export type GeocodingResult = z.infer<typeof geocodingResultSchema>;
export type PropertyType = (typeof propertyTypes)[number];
export type Currency = (typeof currencies)[number];
export type PropertyInput = z.infer<typeof propertyInputSchema>;
export type Property = PropertyInput & {
  id: string;
  ownerId: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type User = { id: string; email: string; name: string };
export type Valuation = {
  id: string;
  propertyId: string;
  marketValue: number;
  currency: Currency;
  recordedAt: string;
  origin: 'user' | 'analysis';
};
export type Asset = {
  id: string;
  propertyId: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
};
export type { AnalysisJob, AnalysisResult, Candidate as Comparable } from './analysis';
import type { AnalysisJob } from './analysis';
export type PropertyDetail = Property & {
  valuations: Valuation[];
  assets: Asset[];
  analyses: AnalysisJob[];
};
export function portfolioStats(properties: Property[]) {
  const active = properties.filter((p) => !p.archivedAt);
  return {
    count: active.length,
    countries: new Set(active.map((p) => p.country)).size,
    area: active.reduce((v, p) => v + p.area, 0),
    byCurrency: currencies.flatMap((currency) => {
      const items = active.filter((p) => p.currency === currency);
      if (!items.length) return [];
      const purchasePrice = items.reduce((v, p) => v + Math.round(p.purchasePrice * 100), 0) / 100;
      const marketValue = items.reduce((v, p) => v + Math.round(p.marketValue * 100), 0) / 100;
      return [
        {
          currency,
          count: items.length,
          purchasePrice,
          marketValue,
          gain: Math.round((marketValue - purchasePrice) * 100) / 100,
          gainPercent: purchasePrice ? (100 * (marketValue - purchasePrice)) / purchasePrice : null,
        },
      ];
    }),
  };
}
export function filterProperties(
  properties: Property[],
  filters: {
    query?: string;
    country?: string;
    type?: string;
    archived?: boolean;
    currency?: string;
    rental?: string;
    propertyId?: string;
  },
) {
  const query = filters.query?.trim().toLocaleLowerCase('de') ?? '';
  return properties.filter(
    (p) =>
      Boolean(p.archivedAt) === Boolean(filters.archived) &&
      (!query || `${p.title} ${p.address} ${p.country}`.toLocaleLowerCase('de').includes(query)) &&
      (!filters.country || p.country === filters.country) &&
      (!filters.type || p.type === filters.type) &&
      (!filters.currency || p.currency === filters.currency) &&
      (!filters.propertyId || p.id === filters.propertyId) &&
      (!filters.rental || (p.rental?.status ?? 'unknown') === filters.rental),
  );
}
export function formatMoney(value: number, currency: Currency) {
  return new Intl.NumberFormat('de-AT', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(value);
}
export function clusterProperties(properties: Property[], zoom: number) {
  const cell = 360 / Math.pow(2, Math.max(1, Math.floor(zoom) + 2));
  const groups = new Map<string, Property[]>();
  for (const p of properties) {
    const key = `${Math.floor((p.latitude + 90) / cell)}:${Math.floor((p.longitude + 180) / cell)}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.values()].map((items) => ({
    key: items.map((p) => p.id).join(','),
    latitude: items.reduce((a, p) => a + p.latitude, 0) / items.length,
    longitude: items.reduce((a, p) => a + p.longitude, 0) / items.length,
    items,
  }));
}
export const sampleProperties: PropertyInput[] = [
  {
    title: 'Stadtwohnung · Wien',
    address: 'Beispieladresse Wien (synthetisch)',
    country: 'AT',
    latitude: 48.2082,
    longitude: 16.3738,
    type: 'apartment',
    purchasePrice: 320000,
    marketValue: 375000,
    currency: 'EUR',
    area: 82,
    yearBuilt: 2008,
    amenities: ['Balkon', 'Aufzug'],
    condition: 'good',
    notes: 'TESTDATEN – keine reale Immobilie, keine Marktanalyse.',
    isTestData: true,
    rental: null,
  },
  {
    title: 'Gartenhaus · Berlin',
    address: 'Beispieladresse Berlin (synthetisch)',
    country: 'DE',
    latitude: 52.52,
    longitude: 13.405,
    type: 'house',
    purchasePrice: 550000,
    marketValue: 610000,
    currency: 'EUR',
    area: 145,
    yearBuilt: 2016,
    amenities: ['Garten', 'Garage'],
    condition: 'new',
    notes: 'TESTDATEN – alle Werte sind synthetisch.',
    isTestData: true,
    rental: null,
  },
  {
    title: 'Apartment · Barcelona',
    address: 'Beispieladresse Barcelona (synthetisch)',
    country: 'ES',
    latitude: 41.3874,
    longitude: 2.1686,
    type: 'apartment',
    purchasePrice: 260000,
    marketValue: 295000,
    currency: 'EUR',
    area: 68,
    yearBuilt: 1998,
    amenities: ['Terrasse'],
    condition: 'good',
    notes: 'TESTDATEN – keine reale Adresse.',
    isTestData: true,
    rental: null,
  },
  {
    title: 'Loft · New York',
    address: 'Beispieladresse New York (synthetisch)',
    country: 'US',
    latitude: 40.7128,
    longitude: -74.006,
    type: 'apartment',
    purchasePrice: 720000,
    marketValue: 790000,
    currency: 'USD',
    area: 96,
    yearBuilt: 2012,
    amenities: ['Concierge'],
    condition: 'good',
    notes: 'TESTDATEN – Werte nicht mit EUR zusammenrechnen.',
    isTestData: true,
    rental: null,
  },
];
