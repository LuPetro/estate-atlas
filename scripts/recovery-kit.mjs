import { randomBytes, createCipheriv, createDecipheriv, scrypt } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, stat, open, rm } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable, Writable } from 'node:stream';
import { createInterface } from 'node:readline/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const magic = Buffer.from('EA-BK001');
const derive = (passphrase, salt) =>
  new Promise((resolve, reject) =>
    scrypt(
      passphrase,
      salt,
      32,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
export async function encryptFile(input, output, passphrase) {
  const salt = randomBytes(16),
    iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', await derive(passphrase, salt), iv);
  const header = Buffer.concat([magic, salt, iv]);
  cipher.setAAD(header);
  async function* chunks() {
    yield header;
    for await (const chunk of createReadStream(input)) yield cipher.update(chunk);
    yield cipher.final();
    yield cipher.getAuthTag();
  }
  try {
    await pipeline(
      Readable.from(chunks()),
      createWriteStream(output, { flags: 'wx', mode: 0o600 }),
    );
  } catch (error) {
    if (error.code !== 'EEXIST') await rm(output, { force: true });
    throw error;
  }
}
export async function decryptFile(input, output, passphrase) {
  const size = (await stat(input)).size;
  if (size <= 52) throw new Error('Invalid archive');
  const file = await open(input, 'r');
  let header, tag;
  try {
    header = Buffer.alloc(36);
    tag = Buffer.alloc(16);
    await file.read(header, 0, 36, 0);
    await file.read(tag, 0, 16, size - 16);
  } finally {
    await file.close();
  }
  if (!header.subarray(0, 8).equals(magic)) throw new Error('Invalid archive');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    await derive(passphrase, header.subarray(8, 24)),
    header.subarray(24),
  );
  decipher.setAAD(header);
  decipher.setAuthTag(tag);
  try {
    await pipeline(
      createReadStream(input, { start: 36, end: size - 17 }),
      decipher,
      createWriteStream(output, { flags: 'wx', mode: 0o600 }),
    );
  } catch (error) {
    if (error.code !== 'EEXIST') await rm(output, { force: true });
    throw error;
  }
}
async function passphrase() {
  const index = process.argv.indexOf('--passphrase-file');
  if (index >= 0) {
    const file = path.resolve(process.argv[index + 1] ?? '');
    if ((await stat(file)).mode & 0o077) throw new Error('Passphrase file must be mode 600');
    return (await readFile(file, 'utf8')).trim();
  }
  if (!process.stdin.isTTY)
    throw new Error('Interactive terminal or protected passphrase file required');
  const output = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  process.stderr.write('Backup-Passphrase (mindestens 20 Zeichen, Eingabe verborgen): ');
  try {
    return await rl.question('');
  } finally {
    process.stderr.write('\n');
    rl.close();
  }
}
async function run() {
  process.umask(0o077);
  const command = process.argv[2];
  if (!['export', 'open'].includes(command))
    throw new Error('Usage: recovery-kit.mjs export | open ARCHIVE [--passphrase-file FILE]');
  const secret = await passphrase();
  if (secret.length < 20 || secret.length > 1024)
    throw new Error('Passphrase requires 20–1024 characters');
  const dir = path.join(root, '.local/backups/export');
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (command === 'open') {
    const output = path.join(dir, `recovered-${stamp}.tar`);
    await decryptFile(path.resolve(process.argv[3]), output, secret);
    console.log(`Archive authenticated and decrypted to ${output}. No live data was restored.`);
    return;
  }
  const backups = (await readdir(path.join(root, '.local/backups/automatic')))
    .filter((name) => /^estateatlas-\d{8}T\d{6}Z\.dump$/.test(name))
    .sort();
  if (!backups.length) throw new Error('No database backup found');
  const temp = path.join(dir, `archive-${stamp}.tar.tmp`);
  const output = path.join(dir, `estateatlas-${stamp}.eab`);
  try {
    const child = spawn(
      'tar',
      [
        '-c',
        '-f',
        '-',
        '-C',
        root,
        `.local/backups/automatic/${backups.at(-1)}`,
        ...[
          'account-encryption-key',
          'site.json',
          'compose.env',
          'postgres-admin-password',
          'postgres-app-password',
        ].map((name) => `.local/docker/${name}`),
      ],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const completion = once(child, 'close');
    await pipeline(child.stdout, createWriteStream(temp, { flags: 'wx', mode: 0o600 }));
    if ((await completion)[0] !== 0) throw new Error('Archive preparation failed');
    await encryptFile(temp, output, secret);
    console.log(
      `Encrypted recovery kit created: ${output}\nCopy this file to protected storage outside the VPS; keep the passphrase separately. Provider keys are not included.`,
    );
  } finally {
    await rm(temp, { force: true });
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  run().catch((error) => {
    console.error(
      error.code === 'EEXIST'
        ? 'Output already exists.'
        : 'Recovery kit operation failed. Check files, permissions and passphrase. No live data was changed.',
    );
    process.exitCode = 1;
  });
