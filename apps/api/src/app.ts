import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'node:crypto';
import { z, ZodError } from 'zod';
import type pg from 'pg';
import {
  propertyInputSchema,
  credentialsSchema,
  registerSchema,
  archiveSchema,
  sampleProperties,
  type User,
  type PropertyInput,
} from '@estate-atlas/shared';
import { hashPassword, verifyPassword, newToken, tokenHash } from './auth';
import { toProperty, toValuation, toAsset, toAnalysis } from './database';

declare module 'fastify' {
  interface FastifyRequest {
    user: User | null;
    sessionHash: string | null;
  }
}
class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
const idOf = (req: FastifyRequest) => z.uuid().parse((req.params as { id: string }).id);
const missing = () => new HttpError(404, 'Eintrag nicht gefunden.');
export async function createApp(
  pool: pg.Pool,
  options: { origin?: string; production?: boolean; logging?: boolean } = {},
) {
  const origin = options.origin ?? 'http://localhost:3000';
  if (options.production && !origin.startsWith('https://'))
    throw new Error('Production WEB_ORIGIN must use HTTPS.');
  const app = Fastify({
    logger: options.logging
      ? {
          redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
          level: 'info',
        }
      : false,
    bodyLimit: 128 * 1024,
    trustProxy: false,
  });
  await app.register(cors, {
    origin,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  await app.register(cookie);
  await app.register(helmet, { crossOriginResourcePolicy: { policy: 'same-site' } });
  await app.register(rateLimit, { max: 240, timeWindow: '1 minute' });
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  });
  app.decorateRequest('user', null);
  app.decorateRequest('sessionHash', null);
  app.addHook('onRequest', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') return;
    const bearer = req.headers.authorization;
    const token = bearer?.startsWith('Bearer ') ? bearer.slice(7) : req.cookies.ea_session;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      if (req.headers.origin && req.headers.origin !== origin)
        throw new HttpError(403, 'Nicht erlaubter Ursprung.');
      if (req.cookies.ea_session && !bearer && req.headers.origin !== origin)
        throw new HttpError(403, 'Ursprungsprüfung fehlgeschlagen.');
    }
    if (token && token.length <= 128) {
      const hash = tokenHash(token);
      const { rows } = await pool.query(
        'SELECT u.id,u.email,u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',
        [hash],
      );
      if (rows[0]) {
        req.user = rows[0];
        req.sessionHash = hash;
      }
    }
  });
  const requireUser = async (req: FastifyRequest) => {
    if (!req.user) throw new HttpError(401, 'Bitte anmelden.');
  };
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof ZodError)
      return reply.code(400).send({
        message: 'Ungültige Eingabe. Bitte Pflichtfelder und Werte prüfen.',
        fields: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    const code = (error as { code?: string }).code;
    if (code === '23505')
      return reply.code(409).send({
        message:
          'Die Registrierung konnte nicht abgeschlossen werden. Nutze eine andere E-Mail-Adresse oder melde dich an.',
      });
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) req.log.error({ err: error }, 'Request failed');
    return reply.code(status >= 400 && status < 600 ? status : 500).send({
      message:
        status >= 500
          ? 'Interner Fehler. Bitte erneut versuchen.'
          : error instanceof Error
            ? error.message
            : 'Ungültige Anfrage.',
    });
  });
  const session = async (req: FastifyRequest, reply: FastifyReply, user: User) => {
    const token = newToken();
    await pool.query('DELETE FROM sessions WHERE expires_at<=now()');
    await pool.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
      [tokenHash(token), user.id],
    );
    if (req.headers.origin) {
      reply.setCookie('ea_session', token, {
        httpOnly: true,
        secure: !!options.production,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 86400,
      });
      return { user };
    }
    return { user, token };
  };
  app.get('/health', async () => {
    await pool.query('SELECT 1');
    return { status: 'ok', service: 'EstateAtlas API' };
  });
  app.post(
    '/auth/register',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (req, reply) => {
      const input = registerSchema.parse(req.body);
      const user = { id: randomUUID(), email: input.email, name: input.name };
      await pool.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)', [
        user.id,
        user.email,
        user.name,
        await hashPassword(input.password),
      ]);
      reply.code(201);
      return session(req, reply, user);
    },
  );
  // A fixed dummy hash makes nonexistent-user and incorrect-password checks comparable.
  const dummy = await hashPassword(newToken());
  app.post(
    '/auth/login',
    { config: { rateLimit: { max: 15, timeWindow: '15 minutes' } } },
    async (req, reply) => {
      const input = credentialsSchema.parse(req.body);
      const { rows } = await pool.query(
        'SELECT id,email,name,password_hash FROM users WHERE email=$1',
        [input.email],
      );
      const valid = await verifyPassword(input.password, rows[0]?.password_hash ?? dummy);
      if (!valid || !rows[0]) throw new HttpError(401, 'E-Mail oder Passwort falsch.');
      const { id, email, name } = rows[0];
      return session(req, reply, { id, email, name });
    },
  );
  app.get('/auth/me', { preHandler: requireUser }, async (req) => req.user);
  app.post('/auth/logout', { preHandler: requireUser }, async (req, reply) => {
    await pool.query('DELETE FROM sessions WHERE token_hash=$1', [req.sessionHash]);
    reply.clearCookie('ea_session', {
      path: '/',
      secure: !!options.production,
      httpOnly: true,
      sameSite: 'lax',
    });
    return reply.code(204).send();
  });
  app.get('/properties', { preHandler: requireUser }, async (req) => {
    const { rows } = await pool.query(
      'SELECT * FROM properties WHERE owner_id=$1 ORDER BY created_at DESC,id',
      [req.user!.id],
    );
    return rows.map(toProperty);
  });
  const insert = async (client: pg.PoolClient, owner: string, input: PropertyInput) => {
    const id = randomUUID();
    const { rows } = await client.query(
      'INSERT INTO properties(id,owner_id,data) VALUES($1,$2,$3) RETURNING *',
      [id, owner, JSON.stringify(input)],
    );
    await client.query(
      'INSERT INTO valuations(id,property_id,market_value,currency) VALUES($1,$2,$3,$4)',
      [randomUUID(), id, input.marketValue, input.currency],
    );
    return toProperty(rows[0]);
  };
  app.post('/properties', { preHandler: requireUser }, async (req, reply) => {
    const input = propertyInputSchema.parse(req.body);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await insert(client, req.user!.id, input);
      await client.query('COMMIT');
      return reply.code(201).send(result);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });
  app.post('/properties/test-data', { preHandler: requireUser }, async (req, reply) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [req.user!.id]);
      const existing = await client.query(
        "SELECT 1 FROM properties WHERE owner_id=$1 AND data->>'isTestData'='true'",
        [req.user!.id],
      );
      if (existing.rowCount) throw new HttpError(409, 'Testdaten sind bereits vorhanden.');
      const output = [];
      for (const input of sampleProperties)
        output.push(await insert(client, req.user!.id, propertyInputSchema.parse(input)));
      await client.query('COMMIT');
      return reply.code(201).send(output);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });
  app.get('/properties/:id', { preHandler: requireUser }, async (req) => {
    const id = idOf(req);
    const property = await pool.query('SELECT * FROM properties WHERE id=$1 AND owner_id=$2', [
      id,
      req.user!.id,
    ]);
    if (!property.rows[0]) throw missing();
    const [valuations, assets, analyses] = await Promise.all([
      pool.query('SELECT * FROM valuations WHERE property_id=$1 ORDER BY recorded_at,id', [id]),
      pool.query(
        'SELECT id,property_id,name,mime_type,size,created_at FROM assets WHERE property_id=$1 ORDER BY created_at',
        [id],
      ),
      pool.query('SELECT * FROM analysis_jobs WHERE property_id=$1 ORDER BY requested_at DESC', [
        id,
      ]),
    ]);
    return {
      ...toProperty(property.rows[0]),
      valuations: valuations.rows.map(toValuation),
      assets: assets.rows.map(toAsset),
      analyses: analyses.rows.map(toAnalysis),
    };
  });
  app.put('/properties/:id', { preHandler: requireUser }, async (req) => {
    const id = idOf(req);
    const input = propertyInputSchema.parse(req.body);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const old = await client.query(
        'SELECT * FROM properties WHERE id=$1 AND owner_id=$2 FOR UPDATE',
        [id, req.user!.id],
      );
      if (!old.rows[0]) throw missing();
      if (
        old.rows[0].data.marketValue !== input.marketValue ||
        old.rows[0].data.currency !== input.currency
      )
        await client.query(
          'INSERT INTO valuations(id,property_id,market_value,currency) VALUES($1,$2,$3,$4)',
          [randomUUID(), id, input.marketValue, input.currency],
        );
      const { rows } = await client.query(
        'UPDATE properties SET data=$1,updated_at=now() WHERE id=$2 AND owner_id=$3 RETURNING *',
        [JSON.stringify(input), id, req.user!.id],
      );
      await client.query('COMMIT');
      return toProperty(rows[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });
  app.patch('/properties/:id/archive', { preHandler: requireUser }, async (req) => {
    const id = idOf(req);
    const { archived } = archiveSchema.parse(req.body);
    const { rows } = await pool.query(
      'UPDATE properties SET archived_at=CASE WHEN $1 THEN now() ELSE NULL END,updated_at=now() WHERE id=$2 AND owner_id=$3 RETURNING *',
      [archived, id, req.user!.id],
    );
    if (!rows[0]) throw missing();
    return toProperty(rows[0]);
  });
  app.delete('/properties/:id', { preHandler: requireUser }, async (req, reply) => {
    const result = await pool.query('DELETE FROM properties WHERE id=$1 AND owner_id=$2', [
      idOf(req),
      req.user!.id,
    ]);
    if (!result.rowCount) throw missing();
    return reply.code(204).send();
  });
  app.post('/properties/:id/assets', { preHandler: requireUser }, async (req, reply) => {
    const id = idOf(req);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const owned = await client.query(
        'SELECT id FROM properties WHERE id=$1 AND owner_id=$2 FOR UPDATE',
        [id, req.user!.id],
      );
      if (!owned.rowCount) throw missing();
      const file = await req.file();
      if (!file) throw new HttpError(400, 'Datei fehlt.');
      const content = await file.toBuffer();
      if (!content.length) throw new HttpError(400, 'Leere Datei.');
      const actual = content.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
        ? 'image/jpeg'
        : content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          ? 'image/png'
          : content.subarray(0, 4).toString() === 'RIFF' &&
              content.subarray(8, 12).toString() === 'WEBP'
            ? 'image/webp'
            : content.subarray(0, 5).toString() === '%PDF-'
              ? 'application/pdf'
              : null;
      if (!actual || actual !== file.mimetype)
        throw new HttpError(
          400,
          'Nur JPEG, PNG, WebP und PDF mit passendem Dateiinhalt sind erlaubt.',
        );
      const total = await client.query(
        'SELECT count(*)::int AS count FROM assets WHERE property_id=$1',
        [id],
      );
      if (total.rows[0].count >= 30) throw new HttpError(400, 'Maximal 30 Anhänge pro Immobilie.');
      const name =
        file.filename
          .split(/[\\/]/)
          .pop()!
          .replace(/[\x00-\x1f\x7f]/g, '')
          .slice(0, 200) || 'Anhang';
      const { rows } = await client.query(
        'INSERT INTO assets(id,property_id,name,mime_type,size,content) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,property_id,name,mime_type,size,created_at',
        [randomUUID(), id, name, actual, content.length, content],
      );
      await client.query('COMMIT');
      return reply.code(201).send(toAsset(rows[0]));
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });
  app.get('/assets/:id', { preHandler: requireUser }, async (req, reply) => {
    const { rows } = await pool.query(
      'SELECT a.* FROM assets a JOIN properties p ON p.id=a.property_id WHERE a.id=$1 AND p.owner_id=$2',
      [idOf(req), req.user!.id],
    );
    if (!rows[0]) throw missing();
    const asset = rows[0];
    reply
      .header('Content-Type', asset.mime_type)
      .header(
        'Content-Disposition',
        `${asset.mime_type === 'application/pdf' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(asset.name)}`,
      )
      .header('X-Content-Type-Options', 'nosniff');
    return reply.send(asset.content);
  });
  app.delete('/assets/:id', { preHandler: requireUser }, async (req, reply) => {
    const result = await pool.query(
      'DELETE FROM assets a USING properties p WHERE a.property_id=p.id AND a.id=$1 AND p.owner_id=$2',
      [idOf(req), req.user!.id],
    );
    if (!result.rowCount) throw missing();
    return reply.code(204).send();
  });
  app.post('/properties/:id/analyses', { preHandler: requireUser }, async (req, reply) => {
    const id = idOf(req);
    const { rows } = await pool.query(
      "INSERT INTO analysis_jobs(id,property_id,status,reason) SELECT $1,p.id,'blocked',$2 FROM properties p WHERE p.id=$3 AND p.owner_id=$4 RETURNING *",
      [
        randomUUID(),
        'Recherche wartet auf freigegebene Datenquellen und API-Zugänge. Es wurde keine Bewertung erstellt.',
        id,
        req.user!.id,
      ],
    );
    if (!rows[0]) throw missing();
    return reply.code(201).send(toAnalysis(rows[0]));
  });
  return app;
}
