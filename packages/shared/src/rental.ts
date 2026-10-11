import { z } from 'zod';

export const rentalSchema = z
  .discriminatedUnion('status', [
    z
      .object({
        status: z.literal('vacant'),
        start: z.null().default(null),
        end: z.null().default(null),
      })
      .strict(),
    z
      .object({
        status: z.literal('rented'),
        start: z.iso.date({
          error: 'Bitte einen gültigen Mietbeginn im Format JJJJ-MM-TT angeben.',
        }),
        end: z.iso
          .date({ error: 'Bitte ein gültiges Mietende im Format JJJJ-MM-TT angeben.' })
          .nullable()
          .default(null),
      })
      .strict(),
  ])
  .superRefine((rental, ctx) => {
    if (rental.status === 'rented' && rental.end && rental.end < rental.start)
      ctx.addIssue({
        code: 'custom',
        path: ['end'],
        message: 'Das Mietende darf nicht vor dem Mietbeginn liegen.',
      });
  });
export type Rental = z.infer<typeof rentalSchema>;
const date = (value: string) =>
  new Intl.DateTimeFormat('de-AT', { timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
export function rentalSummary(rental: Rental | null | undefined, now = new Date()) {
  if (!rental) return { label: 'Vermietung nicht angegeben', period: null };
  if (rental.status === 'vacant') return { label: 'Nicht vermietet', period: null };
  const today = now.toISOString().slice(0, 10);
  return {
    label:
      rental.start > today
        ? 'Vermietung geplant'
        : rental.end && rental.end < today
          ? 'Mietzeitraum beendet'
          : 'Vermietet',
    period: `${date(rental.start)} – ${rental.end ? date(rental.end) : 'unbefristet'}`,
  };
}
