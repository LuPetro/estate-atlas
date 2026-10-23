import type { FastifyInstance, FastifyRequest } from 'fastify';
import type pg from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  cashflowCreateSchema,
  cashflowUpdateSchema,
  cashflowDeleteSchema,
  cashflowQuerySchema,
  groupCashflowTotals,
  localDateKey,
  type CashflowEntry,
  type PropertyCashflowTotals,
} from '@estate-atlas/shared';
import { propertyFor, requestError } from './property-access';

const idOf = (req: FastifyRequest, name = 'id') =>
  z.uuid().parse((req.params as Record<string, string>)[name]);
const toEntry = (row: Record<string, any>): CashflowEntry => ({
  id: row.id,
  propertyId: row.property_id,
  propertyTitle: row.property_title,
  title: row.title,
  date: row.booked_on instanceof Date ? localDateKey(row.booked_on) : row.booked_on,
  category: row.category,
  amount: Number(row.amount),
  currency: row.currency,
  notes: row.notes,
  version: row.version,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});
const conflict = () =>
  requestError(
    409,
    'Diese Buchung wurde inzwischen geändert. Bitte die aktuelle Liste laden und deine Änderung erneut übernehmen.',
  );

export function registerCashflowRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  requireUser: (req: FastifyRequest) => Promise<void>,
) {
  const transaction = async <T>(work: (client: pg.PoolClient) => Promise<T>, readOnly = false) => {
    const client = await pool.connect();
    try {
      await client.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };
  app.get('/portfolio/cashflow', { preHandler: requireUser }, async (req) => {
    const input = cashflowQuerySchema.parse(req.query);
    return transaction(async (client) => {
      if (input.propertyId) await propertyFor(client, input.propertyId, req.user!.id);
      const values = [req.user!.id, `${input.month}-01`, input.propertyId ?? null, input.scope];
      const source = `FROM property_cashflow_entries e JOIN properties p ON p.id=e.property_id
        WHERE (p.owner_id=$1 OR ($4='all' AND EXISTS(SELECT 1 FROM property_members m WHERE m.property_id=p.id AND m.user_id=$1)))
          AND e.booked_on>=$2::date AND e.booked_on<($2::date+interval '1 month')
          AND ($3::uuid IS NULL OR p.id=$3)`;
      const total = Number(
        (await client.query(`SELECT count(*) AS count ${source}`, values)).rows[0].count,
      );
      const pageSize = 50,
        page = Math.min(input.page, Math.max(1, Math.ceil(total / pageSize)));
      const entries = (
        await client.query(
          `SELECT e.*,p.data->>'title' AS property_title ${source}
        ORDER BY e.booked_on DESC,e.created_at DESC,e.id LIMIT $5 OFFSET $6`,
          [...values, pageSize, (page - 1) * pageSize],
        )
      ).rows.map(toEntry);
      const grouped = (
        await client.query(
          `SELECT p.id AS property_id,p.data->>'title' AS property_title,e.currency,
        sum(CASE WHEN e.category IN ('rent','other_income') THEN e.amount ELSE 0 END) AS income,
        sum(CASE WHEN e.category IN ('rent','other_income') THEN 0 ELSE e.amount END) AS expenses
        ${source} GROUP BY p.id,e.currency ORDER BY p.data->>'title',p.id,e.currency`,
          values,
        )
      ).rows;
      try {
        const byProperty: PropertyCashflowTotals[] = grouped.map((row) => {
          const [totals] = groupCashflowTotals([
            {
              currency: row.currency,
              income: Number(row.income),
              expenses: Number(row.expenses),
              balance: 0,
            },
          ]);
          return { ...totals, propertyId: row.property_id, propertyTitle: row.property_title };
        });
        return {
          month: input.month,
          entries,
          byProperty,
          totals: groupCashflowTotals(byProperty),
          total,
          page,
          pageSize,
        };
      } catch (error) {
        if (error instanceof RangeError) throw requestError(422, error.message);
        throw error;
      }
    }, true);
  });
  app.post('/properties/:id/cashflow', { preHandler: requireUser }, async (req, reply) => {
    const propertyId = idOf(req),
      input = cashflowCreateSchema.parse(req.body);
    const entry = await transaction(async (client) => {
      const property = await propertyFor(client, propertyId, req.user!.id, 'edit', true);
      if (property.archived_at)
        throw requestError(
          409,
          'Die Immobilie ist archiviert. Bitte zum Bearbeiten wiederherstellen.',
        );
      const previous = (
        await client.query(
          'SELECT *, $3::text AS property_title FROM property_cashflow_entries WHERE property_id=$1 AND request_key=$2',
          [propertyId, input.requestKey, property.data.title],
        )
      ).rows[0];
      if (previous) {
        const value = toEntry(previous);
        if (
          previous.created_by !== req.user!.id ||
          value.title !== input.title ||
          value.date !== input.date ||
          value.category !== input.category ||
          value.amount !== input.amount ||
          value.currency !== input.currency ||
          value.notes !== input.notes
        )
          throw requestError(
            409,
            'Diese Speicheranfrage wurde bereits verarbeitet. Bitte die Buchungsliste aktualisieren.',
          );
        return value;
      }
      const count = Number(
        (
          await client.query(
            'SELECT count(*) AS count FROM property_cashflow_entries WHERE property_id=$1',
            [propertyId],
          )
        ).rows[0].count,
      );
      if (count >= 10000) throw requestError(409, 'Maximal 10.000 Buchungen pro Immobilie.');
      const { rows } = await client.query(
        `INSERT INTO property_cashflow_entries(id,property_id,created_by,request_key,title,booked_on,category,amount,currency,notes)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *, $11::text AS property_title`,
        [
          randomUUID(),
          propertyId,
          req.user!.id,
          input.requestKey,
          input.title,
          input.date,
          input.category,
          input.amount,
          input.currency,
          input.notes,
          property.data.title,
        ],
      );
      return toEntry(rows[0]);
    });
    return reply.code(201).send(entry);
  });
  app.put('/properties/:id/cashflow/:entryId', { preHandler: requireUser }, async (req) => {
    const propertyId = idOf(req),
      entryId = idOf(req, 'entryId'),
      input = cashflowUpdateSchema.parse(req.body);
    return transaction(async (client) => {
      const property = await propertyFor(client, propertyId, req.user!.id, 'edit', true);
      if (property.archived_at)
        throw requestError(
          409,
          'Die Immobilie ist archiviert. Bitte zum Bearbeiten wiederherstellen.',
        );
      const previous = (
        await client.query(
          'SELECT version FROM property_cashflow_entries WHERE id=$1 AND property_id=$2',
          [entryId, propertyId],
        )
      ).rows[0];
      if (!previous) throw requestError(404, 'Buchung nicht gefunden.');
      if (previous.version !== input.expectedVersion) throw conflict();
      const { rows } = await client.query(
        `UPDATE property_cashflow_entries SET title=$3,booked_on=$4,category=$5,amount=$6,currency=$7,notes=$8,version=version+1,updated_at=now()
        WHERE id=$1 AND property_id=$2 AND version=$9 RETURNING *, $10::text AS property_title`,
        [
          entryId,
          propertyId,
          input.title,
          input.date,
          input.category,
          input.amount,
          input.currency,
          input.notes,
          input.expectedVersion,
          property.data.title,
        ],
      );
      if (!rows[0]) throw conflict();
      return toEntry(rows[0]);
    });
  });
  app.delete(
    '/properties/:id/cashflow/:entryId',
    { preHandler: requireUser },
    async (req, reply) => {
      const propertyId = idOf(req),
        entryId = idOf(req, 'entryId'),
        { expectedVersion } = cashflowDeleteSchema.parse(req.body);
      await transaction(async (client) => {
        const property = await propertyFor(client, propertyId, req.user!.id, 'edit', true);
        if (property.archived_at)
          throw requestError(
            409,
            'Die Immobilie ist archiviert. Bitte zum Bearbeiten wiederherstellen.',
          );
        const previous = (
          await client.query(
            'SELECT version FROM property_cashflow_entries WHERE id=$1 AND property_id=$2',
            [entryId, propertyId],
          )
        ).rows[0];
        if (!previous) throw requestError(404, 'Buchung nicht gefunden.');
        if (previous.version !== expectedVersion) throw conflict();
        await client.query(
          'DELETE FROM property_cashflow_entries WHERE id=$1 AND property_id=$2 AND version=$3',
          [entryId, propertyId, expectedVersion],
        );
      });
      return reply.code(204).send();
    },
  );
}
