import type pg from 'pg';
export async function cleanupExpired(pool: pg.Pool, retention: number) {
  if (!Number.isInteger(retention) || retention < 7 || retention > 730)
    throw new Error('Invalid audit retention');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM sessions WHERE expires_at<=now()');
    await client.query('DELETE FROM account_tokens WHERE expires_at<=now()');
    await client.query(
      "DELETE FROM property_invitations WHERE expires_at<now()-interval '30 days'",
    );
    await client.query("DELETE FROM analysis_requests WHERE requested_at<now()-interval '2 days'");
    await client.query(
      "DELETE FROM account_audit WHERE created_at<now()-$1::int*interval '1 day'",
      [retention],
    );
    await client.query(
      "UPDATE users SET mfa_pending_secret=NULL,mfa_pending_at=NULL WHERE mfa_pending_at<now()-interval '1 hour'",
    );
    await client.query('COMMIT');
  } catch {
    await client.query('ROLLBACK');
    throw new Error('Maintenance cleanup failed.');
  } finally {
    client.release();
  }
}
