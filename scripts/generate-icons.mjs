import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
const dir = new URL('../apps/web/public/icons/', import.meta.url);
await mkdir(dir, { recursive: true });
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="110" fill="#172e35"/><circle cx="256" cy="256" r="145" fill="none" stroke="#80d8c3" stroke-width="12"/><path d="M315 197L285 285 197 315 227 227Z" fill="#80d8c3"/><path d="M256 256L315 197 285 285Z" fill="#fff"/><circle cx="256" cy="256" r="9" fill="#172e35"/></svg>`;
await writeFile(new URL('icon.svg', dir), svg);
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
])
  await sharp(Buffer.from(name === 'maskable-512.png' ? svg.replace('rx="110"', 'rx="0"') : svg))
    .resize(size, size)
    .png()
    .toFile(new URL(name, dir).pathname);
