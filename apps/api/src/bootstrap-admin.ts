import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { emailSchema } from '@estate-atlas/shared';
import { database } from './database';
import { connectionString } from './runtime-config';
dotenv.config({ path: new URL('../../../.env', import.meta.url), quiet: true });
const email = emailSchema.parse(process.argv[2]);
const pool = database(await connectionString(process.env));
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(428716026)');
  if ((await client.query("SELECT 1 FROM users WHERE role='admin'")).rowCount)
    throw new Error('An administrator already exists. Use the admin panel for additional roles.');
  const row = (
    await client.query("SELECT id FROM users WHERE email=$1 AND status='active' FOR UPDATE", [
      email,
    ])
  ).rows[0];
  if (!row)
    throw new Error(
      'Existing active account required. Register first; no account or default password is created.',
    );
  await client.query("UPDATE users SET role='admin',auth_version=auth_version+1 WHERE id=$1", [
    row.id,
  ]);
  await client.query('DELETE FROM sessions WHERE user_id=$1', [row.id]);
  await client.query(
    "INSERT INTO account_audit(id,target_id,action,reason) VALUES($1,$2,'admin.bootstrap','One-time operator CLI bootstrap')",
    [randomUUID(), row.id],
  );
  await client.query('COMMIT');
  console.log(
    'First administrator assigned. Sign in and enable two-factor authentication in Account; admin access stays locked until then.',
  );
} catch (error) {
  await client.query('ROLLBACK');
  console.error(error instanceof Error ? error.message : 'Bootstrap failed.');
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
