import type pg from 'pg';

export const requestError = (statusCode: number, message: string) =>
  Object.assign(new Error(message), { statusCode });

/** Every collaborating write and permission change locks the property first. */
export async function propertyFor(
  db: pg.Pool | pg.PoolClient,
  id: string,
  userId: string,
  permission: 'read' | 'edit' | 'owner' = 'read',
  lock = false,
) {
  const { rows } = await db.query(
    `SELECT * FROM properties WHERE id=$1${lock ? ' FOR UPDATE' : ''}`,
    [id],
  );
  const property = rows[0];
  if (!property) throw requestError(404, 'Eintrag nicht gefunden.');
  const role =
    property.owner_id === userId
      ? 'owner'
      : (
          await db.query('SELECT role FROM property_members WHERE property_id=$1 AND user_id=$2', [
            id,
            userId,
          ])
        ).rows[0]?.role;
  if (
    !role ||
    (permission === 'owner' && role !== 'owner') ||
    (permission === 'edit' && role === 'viewer')
  )
    throw requestError(404, 'Eintrag nicht gefunden.');
  return { ...property, access: role };
}
