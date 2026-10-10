import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const cache = path.join(root, '.local/cache');
mkdirSync(cache, { recursive: true });
const os = process.platform === 'linux' ? 'linux' : process.platform === 'darwin' ? 'macOS' : null;
const arch = process.arch === 'x64' ? 'amd64' : process.arch === 'arm64' ? 'arm64' : null;
if (!os || !arch) throw new Error('Unsupported platform for this project-local installer.');
const get = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': 'EstateAtlas-local-bootstrap' } });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res;
};
const release = await (await get('https://api.github.com/repos/cli/cli/releases/latest')).json();
const asset = release.assets.find((a) => a.name.endsWith(`_${os}_${arch}.tar.gz`));
const checksum = release.assets.find((a) => a.name.endsWith('_checksums.txt'));
if (!asset || !checksum) throw new Error('Release artifacts not found.');
const sums = await (await get(checksum.browser_download_url)).text();
const expected = sums
  .split('\n')
  .find((l) => l.trim().endsWith(asset.name))
  ?.trim()
  .split(/\s+/)[0];
const data = Buffer.from(await (await get(asset.browser_download_url)).arrayBuffer());
if (createHash('sha256').update(data).digest('hex') !== expected)
  throw new Error('Checksum mismatch.');
const archive = path.join(cache, asset.name);
writeFileSync(archive, data);
const target = path.join(root, '.local/gh');
mkdirSync(target, { recursive: true });
execFileSync('tar', ['-xzf', archive, '--strip-components=1', '-C', target]);
console.log(
  `GitHub CLI ${release.tag_name} installed locally. No login or repository creation performed.`,
);
