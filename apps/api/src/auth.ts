import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
// OWASP's memory/CPU-balanced scrypt recommendation: N=2^15, r=8, p=3.
const derive = (password: string, salt: string, N = 32768, r = 8, p = 3) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, 64, { N, r, p, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt);
  return `scrypt:32768:8:3:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, hex] = parts;
  if (
    n !== '32768' ||
    r !== '8' ||
    p !== '3' ||
    !/^[a-f0-9]{32}$/.test(salt) ||
    !/^[a-f0-9]{128}$/.test(hex)
  )
    return false;
  const expected = Buffer.from(hex, 'hex');
  const actual = await derive(password, salt);
  return timingSafeEqual(expected, actual);
}
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
