import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [keys, auth, analytics, monitoring, usage, docs] = await Promise.all([
  read('src/app/api/developer/keys/route.ts'),
  read('src/lib/api/open-api-middleware.ts'),
  read('src/app/api/v1/projects/[id]/analytics/route.ts'),
  read('src/app/api/v1/projects/[id]/monitoring/route.ts'),
  read('src/app/api/developer/usage/route.ts'),
  read('src/app/api/v1/docs/route.ts'),
]);

assert.match(keys, /crypto\.randomBytes\(32\)/, 'API keys must use cryptographic randomness');
assert.match(keys, /allowedPermissions/, 'API key permissions must be allow-listed');
assert.match(auth, /prisma\.apiKey\.findUnique/, 'Open API authentication must use the persistent key store');
assert.match(auth, /API_KEY_STORE_UNAVAILABLE/, 'Authentication storage failures must be fail-closed and observable');
assert.doesNotMatch(analytics, /Math\.random|success:\s*true/, 'Unverified analytics must never return generated success data');
assert.match(analytics, /VERIFIED_ANALYTICS_UNAVAILABLE/);
assert.match(monitoring, /TELEMETRY_NOT_CONNECTED/);
assert.doesNotMatch(usage, /Math\.random|125|3256|6744/, 'Usage reporting must not contain synthetic metrics');
assert.match(usage, /prisma\.apiLog\.findMany/);
assert.match(docs, /\?\.\['\/projects\/\{id\}\/analytics'\]|'\/projects\/\{id\}\/analytics'/);
assert.match(docs, /'503'/, 'OpenAPI must document fail-closed telemetry and analytics');

console.log('Open API persistence, accuracy, and documentation contracts passed.');
