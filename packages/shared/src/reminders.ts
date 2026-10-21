import { z } from 'zod';

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
