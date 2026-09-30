import assert from 'node:assert/strict';
import { validatePublicBuildConfig } from './validate-public-build-config.mjs';

const cn = { NEXT_PUBLIC_APP_EDITION: 'cn', NEXT_PUBLIC_API_URL: '/api/backend' };
let cases = 0;
const ok = (env) => { cases++; assert.doesNotThrow(() => validatePublicBuildConfig(env)); };
const bad = (env, pattern) => { cases++; assert.throws(() => validatePublicBuildConfig(env), pattern); };

// 通过：同源代理、显式生产 HTTPS 地址
ok(cn);
ok({ ...cn, NEXT_PUBLIC_API_URL: 'https://cn.energy-thinktank.com/api' });

// 只构建国内版：缺省、国际版、别的值一律拒绝
bad({ NEXT_PUBLIC_API_URL: '/api/backend' }, /cn/);
bad({ ...cn, NEXT_PUBLIC_APP_EDITION: 'int' }, /cn/);
bad({ ...cn, NEXT_PUBLIC_APP_EDITION: 'global' }, /cn/);

// 境外托管数据库配置：三个变量任何一个出现都拒绝
for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    bad({ ...cn, [key]: 'https://x.supabase.co' }, /不得配置/);
}

// API 地址：本机、占位、带凭据、非 HTTPS、未知相对路径、缺省
for (const url of ['', 'http://localhost/api', 'https://api.example.com/api', 'https://user:pw@cn.energy-thinktank.com/api',
    'http://cn.energy-thinktank.com/api', 'https://x.invalid/api', '/api/other', 'https://127.0.0.1/api']) {
    bad({ ...cn, NEXT_PUBLIC_API_URL: url });
}
console.log(`${cases} public build configuration cases passed (synthetic values; no connectivity validation)`);
