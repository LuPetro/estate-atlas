import { z } from 'zod';
import { currencies } from './index';

const amount = z
  .number()
  .finite()
  .min(0)
  .max(1e12)
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.001,
    'Höchstens zwei Nachkommastellen',
  );
const percentage = z.number().finite().min(0).max(100);
export const purchaseCheckSchema = z
  .object({
    currency: z.lazy(() => z.enum(currencies)),
    purchasePrice: amount,
    transferTaxPercent: percentage,
    notaryPercent: percentage,
    agentPercent: percentage,
    otherCosts: amount,
    renovationBudget: amount,
    equity: amount,
  })
  .strict()
  .superRefine((input, context) => {
    if (input.currency !== 'JPY') return;
    for (const field of ['purchasePrice', 'otherCosts', 'renovationBudget', 'equity'] as const)
      if (!Number.isInteger(input[field]))
        context.addIssue({
          code: 'custom',
          path: [field],
          message: 'JPY-Beträge müssen ganzzahlig sein.',
        });
  });
export type PurchaseCheckInput = z.infer<typeof purchaseCheckSchema>;

/** User-entered assumptions only; percentages are not jurisdiction-specific defaults. */
export function calculatePurchaseCheck(input: PurchaseCheckInput) {
  const checked = purchaseCheckSchema.parse(input);
  const scale = checked.currency === 'JPY' ? 1 : 100;
  const round = (value: number) => Math.round(value * scale) / scale;
  const transferTax = round((checked.purchasePrice * checked.transferTaxPercent) / 100);
  const notaryCosts = round((checked.purchasePrice * checked.notaryPercent) / 100);
  const agentCosts = round((checked.purchasePrice * checked.agentPercent) / 100);
  const additionalCosts = round(transferTax + notaryCosts + agentCosts + checked.otherCosts);
  const totalInvestment = round(checked.purchasePrice + additionalCosts + checked.renovationBudget);
  return {
    transferTax,
    notaryCosts,
    agentCosts,
    additionalCosts,
    totalInvestment,
    fundingGap: round(Math.max(0, totalInvestment - checked.equity)),
    equitySurplus: round(Math.max(0, checked.equity - totalInvestment)),
  };
}

const itemSchema = z
  .object({
    id: z.uuid(),
    label: z.string().trim().min(1).max(200),
    done: z.boolean(),
    note: z.string().trim().max(1000),
  })
  .strict();
export const checklistSchema = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(1).max(120),
    date: z.iso.date().nullable(),
    notes: z.string().trim().max(3000),
    items: z.array(itemSchema).max(80),
  })
  .strict()
  .superRefine((list, context) => {
    if (new Set(list.items.map((item) => item.id)).size !== list.items.length)
      context.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'Doppelte Einträge sind nicht erlaubt.',
      });
  });
export type Checklist = z.infer<typeof checklistSchema>;
export const workspaceContentSchema = z
  .object({
    checklists: z.array(checklistSchema).max(12),
    purchaseCheck: purchaseCheckSchema.nullable(),
  })
  .strict()
  .superRefine((content, context) => {
    if (JSON.stringify(content).length > 128000)
      context.addIssue({
        code: 'custom',
        message: 'Der Arbeitsbereich ist zu groß. Bitte Checklisten oder Notizen kürzen.',
      });
    if (new Set(content.checklists.map((list) => list.id)).size !== content.checklists.length)
      context.addIssue({
        code: 'custom',
        path: ['checklists'],
        message: 'Doppelte Checklisten sind nicht erlaubt.',
      });
  });
export const workspaceSaveSchema = z
  .object({
    expectedVersion: z.number().int().min(0).max(2147483646),
    checklists: workspaceContentSchema.shape.checklists,
    purchaseCheck: workspaceContentSchema.shape.purchaseCheck,
  })
  .strict()
  .superRefine((input, context) => {
    const result = workspaceContentSchema.safeParse({
      checklists: input.checklists,
      purchaseCheck: input.purchaseCheck,
    });
    if (!result.success)
      for (const issue of result.error.issues)
        context.addIssue({ code: 'custom', path: issue.path, message: issue.message });
  });
export type WorkspaceSaveInput = z.infer<typeof workspaceSaveSchema>;
export type PropertyWorkspace = z.infer<typeof workspaceContentSchema> & { version: number };

export const checklistTemplates = [
  {
    id: 'handover',
    title: 'Objektübergabe',
    items: [
      'Zählerstände dokumentieren',
      'Schlüssel zählen und zuordnen',
      'Räume und Zustand prüfen',
      'Mängel und offene Arbeiten festhalten',
      'Heizung, Wasser und Elektrik prüfen',
      'Dokumente und Bedienungsanleitungen übernehmen',
      'Fotos im Dokumentenbereich ablegen',
      'Übergabeprotokoll gemeinsam bestätigen',
    ],
  },
  {
    id: 'viewing',
    title: 'Besichtigung',
    items: [
      'Lage und Umgebung ansehen',
      'Grundriss und Flächen prüfen',
      'Fenster und Dämmung prüfen',
      'Feuchtigkeit und Schäden prüfen',
      'Heizung und Energieausweis ansehen',
      'Laufende Kosten erfragen',
      'Renovierungsbedarf notieren',
      'Offene Fragen klären',
    ],
  },
] as const;

export type PropertyAccess = 'owner' | 'editor' | 'viewer';
export const invitationInputSchema = z.object({ role: z.enum(['viewer', 'editor']) }).strict();
export const invitationAcceptSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{43}$/),
  })
  .strict();
export type PropertyInvitation = { id: string; role: 'viewer' | 'editor'; expiresAt: string };
export type CreatedPropertyInvitation = PropertyInvitation & { code: string };
export type PropertyMember = {
  userId: string;
  name: string;
  email: string;
  role: 'viewer' | 'editor';
  createdAt: string;
};
export type PropertyShares = { members: PropertyMember[]; invitations: PropertyInvitation[] };
