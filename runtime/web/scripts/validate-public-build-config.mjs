import { pathToFileURL } from 'node:url';
export function validatePublicBuildConfig(env) {
    // 国内版不接境外托管数据库（2026-09-21 口径），所以不再要求 Supabase 配置。
    // 反过来：国内版**出现** Supabase 配置才是问题，在这里就拦住，
    // 免得构建出一个会把用户数据发到境外的镜像。
    const domestic = env.NEXT_PUBLIC_APP_EDITION === 'cn';
    if (domestic) {
        for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
            if (env[key]) throw new Error(`国内版不得配置 ${key}：境内版本只接自建数据库`);
        }
    }
    const publicUrlKeys = domestic ? ['NEXT_PUBLIC_API_URL'] : ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_SUPABASE_URL'];
    for (const key of publicUrlKeys) {
        let url;
        try { url = new URL(env[key]); } catch { throw new Error(`${key} 必须是有效的生产 HTTPS 地址`); }
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
            || url.hostname === 'localhost' || url.hostname.endsWith('.invalid') || url.hostname.endsWith('.test')
            || url.hostname === 'example.com' || url.hostname.endsWith('.example.com')
            || /^127\./.test(url.hostname) || url.hostname === '[::1]') {
            throw new Error(`${key} 不能使用本机、占位或携带凭据的地址`);
        }
    }
    if (domestic) return;
    const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return;
    try {
        const parts = key.split('.');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        if (parts.length === 3 && parts.every(Boolean) && payload.role === 'anon') return;
    } catch { /* 不输出密钥或解析异常 */ }
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY 必须是公开 anon 或 publishable key，禁止管理密钥');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try { validatePublicBuildConfig(process.env); console.log('公开构建配置格式检查通过；服务连通性仍需验收'); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}
