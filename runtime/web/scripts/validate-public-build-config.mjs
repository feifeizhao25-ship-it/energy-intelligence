import { pathToFileURL } from 'node:url';
export function validatePublicBuildConfig(env) {
    // runtime/web 是国内版专用源码树（国际版是另一棵树），构建出来的镜像只能是国内版。
    if (env.NEXT_PUBLIC_APP_EDITION !== 'cn') {
        throw new Error('runtime/web 只构建国内版：NEXT_PUBLIC_APP_EDITION 必须为 cn');
    }
    // 国内版不接境外托管数据库（2026-09-21 口径）：出现 Supabase 配置就是问题，
    // 在构建期拦住，免得构建出一个会把用户数据发到境外的镜像。
    for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
        if (env[key]) throw new Error(`国内版不得配置 ${key}：境内版本只接自建数据库`);
    }
    // 浏览器经本站 /api/backend 访问后端（同源，网关只需要一个域名）；
    // 也允许显式指定一个生产 HTTPS 地址。
    if (env.NEXT_PUBLIC_API_URL === '/api/backend') return;
    let url;
    try { url = new URL(env.NEXT_PUBLIC_API_URL); } catch { throw new Error('NEXT_PUBLIC_API_URL 必须是 /api/backend 或有效的生产 HTTPS 地址'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
        || url.hostname === 'localhost' || url.hostname.endsWith('.invalid') || url.hostname.endsWith('.test')
        || url.hostname === 'example.com' || url.hostname.endsWith('.example.com')
        || /^127\./.test(url.hostname) || url.hostname === '[::1]') {
        throw new Error('NEXT_PUBLIC_API_URL 不能使用本机、占位或携带凭据的地址');
    }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try { validatePublicBuildConfig(process.env); console.log('公开构建配置格式检查通过；服务连通性仍需验收'); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}
