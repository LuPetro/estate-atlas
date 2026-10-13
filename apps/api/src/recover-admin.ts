import dotenv from 'dotenv';
import { randomBytes, randomUUID } from 'node:crypto';
import { database } from './database';
import { connectionString } from './runtime-config';
import { hashPassword } from './auth';

dotenv.config({ path: new URL('../../../.env', import.meta.url), quiet: true });

if (process.argv[2] !== 'RESET-ONLY-ADMIN') {
  console.error('Usage: node dist/recover-admin.mjs RESET-ONLY-ADMIN');
  process.exit(2);
}

const pool = database(await connectionString(process.env));
const client = await pool.connect();
let temporaryPassword = '';
let administratorEmail = '';
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(428716026)');
  const admins = await client.query(
    "SELECT id,email FROM users WHERE role='admin' AND status='active' ORDER BY created_at FOR UPDATE",
  );
  if (admins.rowCount !== 1)
    throw new Error('Recovery is allowed only when exactly one active administrator exists.');

  const admin = admins.rows[0];
  administratorEmail = admin.email;
  temporaryPassword = randomBytes(24).toString('base64url');
  const passwordHash = await hashPassword(temporaryPassword);

  await client.query(
    "UPDATE users SET password_hash=$2,auth_version=auth_version+1,mfa_secret=NULL,mfa_pending_secret=NULL,mfa_pending_at=NULL,mfa_last_step=-1,recovery_hashes='[]'::jsonb WHERE id=$1",
    [admin.id, passwordHash],
  );
  await client.query('DELETE FROM sessions WHERE user_id=$1', [admin.id]);
  await client.query('DELETE FROM account_tokens WHERE user_id=$1', [admin.id]);
  await client.query(
    "INSERT INTO account_audit(id,target_id,action,reason) VALUES($1,$2,'admin.recovered','Operator reset the sole active administrator password and MFA')",
    [randomUUID(), admin.id],
  );
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  console.error(error instanceof Error ? error.message : 'Administrator recovery failed.');
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}

if (process.exitCode !== 1) {
  console.log(`Admin-Konto wiederhergestellt: ${administratorEmail}`);
  console.log(`Einmal-Passwort: ${temporaryPassword}`);
  console.log('Melde dich damit an, setze sofort dein persönliches Passwort und richte 2FA neu ein.');
  console.log('Immobilien, Rolle und Kontodaten wurden beibehalten.');
}
