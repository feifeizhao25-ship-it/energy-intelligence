import assert from 'node:assert/strict';
import { validatePublicBuildConfig } from './validate-public-build-config.mjs';
const config = { NEXT_PUBLIC_API_URL: 'https://cn.energy-thinktank.com/api', NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_fixture' };
assert.doesNotThrow(() => validatePublicBuildConfig(config));
for (const change of [
    { NEXT_PUBLIC_API_URL: '' }, { NEXT_PUBLIC_API_URL: 'http://localhost/api' },
    { NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.invalid' },
    { NEXT_PUBLIC_SUPABASE_URL: 'https://user:secret@project.supabase.co' },
    { NEXT_PUBLIC_SUPABASE_ANON_KEY: '' }, { NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_private' },
    { NEXT_PUBLIC_SUPABASE_ANON_KEY: `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature` },
]) assert.throws(() => validatePublicBuildConfig({ ...config, ...change }));
const anon = `header.${Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')}.signature`;
assert.doesNotThrow(() => validatePublicBuildConfig({ ...config, NEXT_PUBLIC_SUPABASE_ANON_KEY: anon }));
console.log('9 public build configuration cases passed (synthetic keys; no connectivity validation)');
