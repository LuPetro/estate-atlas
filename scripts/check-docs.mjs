import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ignored = new Set([
  '.git',
  '.local',
  'node_modules',
  '.next',
  '.next-e2e',
  '.expo',
  'dist',
  'work',
  'test-results',
  'playwright-report',
  'coverage',
]);

/** Check local Markdown file/image targets without sending any content to external services. */
export async function documentationErrors(root) {
  const files = [];
  async function visit(dir) {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      if (ignored.has(item.name) || item.isSymbolicLink()) continue;
      const file = path.join(dir, item.name);
      if (item.isDirectory()) await visit(file);
      else if (/\.mdx?$/i.test(item.name)) files.push(file);
    }
  }
  await visit(root);
  const errors = [];
  for (const file of files.sort()) {
    const markdown = (await readFile(file, 'utf8')).replace(
      /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm,
      '',
    );
    for (const match of markdown.matchAll(
      /!?\[[^\]\n]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^\n]*["'])?\s*\)/g,
    )) {
      const target = match[1] ?? match[2];
      if (/^(?:[a-z][a-z\d+.-]*:|#)/i.test(target)) continue;
      const local = target.split(/[?#]/, 1)[0];
      if (!local) continue;
      let resolved;
      try {
        resolved = decodeURIComponent(local);
        const absolute = resolved.startsWith('/')
          ? path.join(root, resolved.slice(1))
          : path.resolve(path.dirname(file), resolved);
        const relative = path.relative(root, absolute);
        if (relative === '..' || relative.startsWith(`..${path.sep}`)) throw new Error();
        await access(absolute);
      } catch {
        errors.push(`${path.relative(root, file)}: missing or invalid local target ${target}`);
      }
    }
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errors = await documentationErrors(fileURLToPath(new URL('../', import.meta.url)));
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else
    console.log('Local Markdown file and image targets exist (external URLs/anchors not checked).');
}
