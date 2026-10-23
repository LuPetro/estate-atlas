import { z } from 'zod';
import { currencies } from './currencies';
import type { Currency } from './index';

export const cashflowCategories = [
  'rent',
  'other_income',
  'operating',
  'repair',
  'loan',
  'other_expense',
] as const;
export type CashflowCategory = (typeof cashflowCategories)[number];
export const cashflowCategoryLabels: Record<CashflowCategory, string> = {
  rent: 'Mieteinnahmen',
  other_income: 'Sonstige Einnahmen',
  operating: 'Laufende Kosten',
  repair: 'Reparatur / Instandhaltung',
  loan: 'Kreditrate',
  other_expense: 'Sonstige Ausgaben',
};
export const isCashflowIncome = (category: CashflowCategory) =>
  category === 'rent' || category === 'other_income';
export const cashflowInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, 'Bitte eine Bezeichnung mit mindestens zwei Zeichen eingeben.')
      .max(120),
    date: z.iso.date().refine((value) => value.slice(0, 4) >= '1900', 'Datum ab 1900 angeben.'),
    category: z.enum(cashflowCategories),
    amount: z
      .number({ error: 'Bitte einen gültigen Betrag ohne Tausendertrennzeichen eingeben.' })
      .finite()
      .positive('Der Betrag muss größer als null sein.')
      .max(1e9, 'Der Betrag darf höchstens eine Milliarde betragen.'),
    currency: z.enum(currencies),
    notes: z.string().trim().max(1000).default(''),
  })
  .strict()
  .superRefine((value, ctx) => {
    const factor = value.currency === 'JPY' ? 1 : 100;
    if (Math.abs(value.amount * factor - Math.round(value.amount * factor)) > 0.00001)
      ctx.addIssue({
        code: 'custom',
        path: ['amount'],
        message:
          value.currency === 'JPY'
            ? 'JPY nur in ganzen Yen angeben.'
            : 'Höchstens zwei Nachkommastellen.',
      });
  });
export const cashflowUpdateSchema = cashflowInputSchema.safeExtend({
  expectedVersion: z.number().int().positive(),
});
export const cashflowCreateSchema = cashflowInputSchema.safeExtend({
  requestKey: z.string().regex(/^[a-zA-Z0-9_-]{16,80}$/),
});
export const cashflowDeleteSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();
export const cashflowQuerySchema = z
  .object({
    month: z.string().regex(/^(?:19|[2-9]\d)\d{2}-(?:0[1-9]|1[0-2])$/),
    propertyId: z.uuid().optional(),
    scope: z.enum(['owned', 'all']).default('owned'),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .strict();
export type CashflowInput = z.infer<typeof cashflowInputSchema>;
export type CashflowEntry = CashflowInput & {
  id: string;
  propertyId: string;
  propertyTitle: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};
export type CashflowTotals = {
  currency: Currency;
  income: number;
  expenses: number;
  balance: number;
};
export type PropertyCashflowTotals = CashflowTotals & { propertyId: string; propertyTitle: string };
export type CashflowReport = {
  month: string;
  entries: CashflowEntry[];
  totals: CashflowTotals[];
  byProperty: PropertyCashflowTotals[];
  total: number;
  page: number;
  pageSize: number;
};

/** Both clients accept a decimal comma, but never guess thousands separators. */
export function cashflowAmount(value: string) {
  const text = value.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) return NaN;
  return Number(text.replace(',', '.'));
}

/** Request identity only, never an authentication token. Retain it until a draft succeeds. */
export const cashflowRequestKey = () =>
  `entry_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;

export function shiftCashflowMonth(value: string, offset: number) {
  const date = new Date(`${value}-15T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export function groupCashflowTotals(rows: CashflowTotals[]): CashflowTotals[] {
  const sums = new Map<Currency, { income: number; expenses: number }>();
  for (const row of rows) {
    const factor = row.currency === 'JPY' ? 1 : 100;
    const previous = sums.get(row.currency) ?? { income: 0, expenses: 0 };
    const income = previous.income + Math.round(row.income * factor);
    const expenses = previous.expenses + Math.round(row.expenses * factor);
    if (!Number.isSafeInteger(income) || !Number.isSafeInteger(expenses))
      throw new RangeError('Geldsumme zu groß. Bitte eine einzelne Immobilie auswählen.');
    sums.set(row.currency, { income, expenses });
  }
  return [...sums]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, value]) => {
      const factor = currency === 'JPY' ? 1 : 100;
      return {
        currency,
        income: value.income / factor,
        expenses: value.expenses / factor,
        balance: (value.income - value.expenses) / factor,
      };
    });
}
