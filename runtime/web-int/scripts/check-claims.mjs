// Guard: international site stays English-only and makes no unverifiable claims.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const walk = (d) => readdirSync(d).flatMap((n) => { const f = join(d, n); return statSync(f).isDirectory() ? walk(f) : /\.(tsx?|css)$/.test(n) ? [f] : []; });
const banned = [/[\u4e00-\u9fff]/, /\bExcel\b/, /\bPPT\b/i, /1,520/, /Most popular/, /cancel at any time/i];
const hits = [];
for (const f of walk(new URL('../src', import.meta.url).pathname)) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return;
    for (const re of banned) if (re.test(line)) hits.push(`${f}:${i + 1} ${re}`);
  });
}
if (hits.length) { console.error(hits.join('\n')); process.exit(1); }
console.log('web-int claims check passed');
