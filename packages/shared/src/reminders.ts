import { z } from 'zod';

/** A calendar day in the device's timezone, without shifting it through UTC. */
export const localDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const reminderEmailSchema = z
  .object({
    daysBefore: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(7)]),
    timeZone: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)*$/)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat('de', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, 'Bitte eine gültige Zeitzone wählen.'),
  })
  .strict();
export type ReminderEmailPreference = z.infer<typeof reminderEmailSchema>;
export const reminderEmailUpdateSchema = z
  .object({ notification: reminderEmailSchema.nullable() })
  .strict();
export type ReminderEmailStatus = ReminderEmailPreference & {
  sendAt: string;
  sentAt: string | null;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'unknown' | 'expired' | 'cancelled';
};
export const reminderEmailLabels: Record<ReminderEmailStatus['status'], string> = {
  pending: 'E-Mail vorgemerkt',
  sending: 'E-Mail wird gesendet',
  sent: 'E-Mail gesendet',
  failed: 'Versand fehlgeschlagen',
  unknown: 'Versandstatus unklar',
  expired: 'Versandzeitraum abgelaufen',
  cancelled: 'E-Mail nicht mehr vorgemerkt',
};

export const reminderInputSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    dueDate: z.iso.date(),
    notes: z.string().trim().max(1000).default(''),
    emailNotification: reminderEmailSchema.nullable().optional(),
  })
  .strict();
export const reminderStatusSchema = z.object({ completed: z.boolean() }).strict();
export type ReminderInput = z.infer<typeof reminderInputSchema>;
export type PortfolioReminder = ReminderInput & {
  id: string;
  propertyId: string;
  propertyTitle: string;
  completedAt: string | null;
  createdAt: string;
  emailNotification?: ReminderEmailStatus | null;
};
