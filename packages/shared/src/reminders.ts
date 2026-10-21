import { z } from 'zod';

/** A calendar day in the device's timezone, without shifting it through UTC. */
export const localDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const reminderInputSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    dueDate: z.iso.date(),
    notes: z.string().trim().max(1000).default(''),
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
};
