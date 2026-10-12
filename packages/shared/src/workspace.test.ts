import { describe, expect, it } from 'vitest';
import {
  calculatePurchaseCheck,
  purchaseCheckSchema,
  workspaceSaveSchema,
  type PurchaseCheckInput,
} from './workspace';

const purchase: PurchaseCheckInput = {
  currency: 'EUR',
  purchasePrice: 300000,
  transferTaxPercent: 3.5,
  notaryPercent: 1.5,
  agentPercent: 2,
  otherCosts: 2000,
  renovationBudget: 40000,
  equity: 100000,
};
const list = {
  id: '5fc58100-2436-4ad9-ac50-7704a0156c81',
  title: 'Übergabe',
  date: '2026-10-11',
  notes: '',
  items: [
    { id: '5fc58100-2436-4ad9-ac50-7704a0156c82', label: 'Zählerstand', done: false, note: '' },
  ],
};
describe('purchase assumptions and persistent checklists', () => {
  it('calculates purchase costs, renovation and remaining funding from explicit inputs', () => {
    expect(calculatePurchaseCheck(purchase)).toEqual({
      transferTax: 10500,
      notaryCosts: 4500,
      agentCosts: 6000,
      additionalCosts: 23000,
      totalInvestment: 363000,
      fundingGap: 263000,
      equitySurplus: 0,
    });
    expect(calculatePurchaseCheck({ ...purchase, equity: 400000 })).toMatchObject({
      fundingGap: 0,
      equitySurplus: 37000,
    });
  });
  it('rounds each cash component in the selected currency and rejects invalid assumptions', () => {
    expect(
      calculatePurchaseCheck({
        ...purchase,
        currency: 'JPY',
        purchasePrice: 123,
        transferTaxPercent: 3.5,
      }),
    ).toMatchObject({ transferTax: 4 });
    for (const change of [
      { equity: -1 },
      { purchasePrice: Infinity },
      { otherCosts: 1.001 },
      { transferTaxPercent: 101 },
      { currency: 'JPY', equity: 0.1 },
    ])
      expect(purchaseCheckSchema.safeParse({ ...purchase, ...change }).success).toBe(false);
  });
  it('validates real calendar dates, unique item IDs and bounded request size', () => {
    const input = { expectedVersion: 0, checklists: [list], purchaseCheck: purchase };
    expect(workspaceSaveSchema.safeParse(input).success).toBe(true);
    for (const changed of [
      { ...input, expectedVersion: -1 },
      { ...input, checklists: [list, list] },
      { ...input, checklists: [{ ...list, date: '2026-02-30' }] },
      { ...input, checklists: [{ ...list, items: [list.items[0], list.items[0]] }] },
      { ...input, ownerId: 'untrusted' },
    ])
      expect(workspaceSaveSchema.safeParse(changed).success).toBe(false);
    const huge = Array.from({ length: 12 }, (_, l) => ({
      ...list,
      id: `5fc58100-2436-4ad9-ac50-7704a0156c${String(l).padStart(2, '0')}`,
      items: Array.from({ length: 80 }, (_, i) => ({
        ...list.items[0],
        id: `5fc58100-2436-4ad9-ac50-7704a0156c${String(i).padStart(2, '0')}`,
        note: '長'.repeat(1000),
      })),
    }));
    expect(workspaceSaveSchema.safeParse({ ...input, checklists: huge }).success).toBe(false);
  });
});
