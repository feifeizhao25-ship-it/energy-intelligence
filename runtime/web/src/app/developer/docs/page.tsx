import Link from 'next/link';
import { getLocale } from 'next-intl/server';

const copy = {
  zh: {
    eyebrow: '开放 API · v1', title: '把可审计的新能源能力接入你的系统',
    intro: '以下只列出代码中已经存在的接口。项目数据按 API Key 所属用户隔离；正式调用前，请在登录后的开发者中心创建密钥并确认会员权限。',
    auth: '认证', authBody: '请求头使用 X-API-Key。密钥只在创建时完整显示，请勿写入网页代码、日志或公开仓库。',
    endpoints: '当前接口', example: '请求示例', reliability: '准确性与错误处理',
    reliabilityBody: '计算结果应同时保存输入、模型版本、来源日期和审计快照。客户端必须处理 401、403、429 与 5xx，不应把暂时失败替换成示例数据。接口能力和限额以实际响应及会员权益为准。',
    schema: '查看机器可读 OpenAPI JSON', console: '登录开发者中心', back: '返回首页',
    notice: '接口输出用于决策支持，不替代持证工程、法律、税务或投资意见。生产域名、服务等级和合同限额在商用发布前另行确认。',
    rows: [['GET', '/api/v1/projects', '分页读取当前用户的项目'], ['GET', '/api/v1/projects/{id}', '读取有权访问的单个项目'], ['GET', '/api/v1/projects/{id}/monitoring', '读取项目监测数据'], ['GET', '/api/v1/projects/{id}/analytics', '读取项目分析结果'], ['GET', '/api/v1/papers/search?q=', '检索文献；结果仍需核对来源与日期'], ['POST', '/api/v1/calculate/solar', '执行带审计快照的光伏收益计算']],
  },
  en: {
    eyebrow: 'Open API · v1', title: 'Connect auditable renewable-energy workflows',
    intro: 'This page lists only endpoints present in the current codebase. Project data is scoped to the API-key owner. Create a key in the authenticated developer console and verify plan entitlements before production use.',
    auth: 'Authentication', authBody: 'Send X-API-Key in the request header. A full key is shown only when created; never place it in browser code, logs, or a public repository.',
    endpoints: 'Available endpoints', example: 'Request example', reliability: 'Reliability and errors',
    reliabilityBody: 'Calculation records should retain inputs, model version, source dates, and an audit snapshot. Clients must handle 401, 403, 429, and 5xx responses and must not substitute sample data for a failure. Actual responses and plan entitlements govern availability and limits.',
    schema: 'View machine-readable OpenAPI JSON', console: 'Sign in to the developer console', back: 'Back to home',
    notice: 'API output supports decisions; it does not replace licensed engineering, legal, tax, or investment advice. Production hostnames, service levels, and contractual limits require confirmation before commercial release.',
    rows: [['GET', '/api/v1/projects', 'List projects owned by the authenticated user'], ['GET', '/api/v1/projects/{id}', 'Read one project the user may access'], ['GET', '/api/v1/projects/{id}/monitoring', 'Read project monitoring data'], ['GET', '/api/v1/projects/{id}/analytics', 'Read project analytics'], ['GET', '/api/v1/papers/search?q=', 'Search papers; verify every source and date'], ['POST', '/api/v1/calculate/solar', 'Run a solar-return calculation with an audit snapshot']],
  },
} as const;

export default async function DeveloperDocsPage() {
  const content = (await getLocale()) === 'en' ? copy.en : copy.zh;
  return <main className="min-h-screen overflow-x-hidden bg-slate-950 px-4 py-12 text-slate-200"><article className="mx-auto min-w-0 max-w-5xl overflow-hidden">
    <p className="font-bold uppercase tracking-[0.2em] text-emerald-400">{content.eyebrow}</p><h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight text-white sm:text-6xl">{content.title}</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">{content.intro}</p>
    <div className="mt-10 grid gap-6 lg:grid-cols-2"><section className="rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-bold text-white">{content.auth}</h2><p className="mt-3 leading-7 text-slate-300">{content.authBody}</p><pre className="mt-5 overflow-x-auto rounded-2xl bg-black/40 p-4 text-sm text-emerald-300"><code>{'X-API-Key: <your-secret-key>'}</code></pre></section><section className="rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-bold text-white">{content.example}</h2><pre className="mt-5 overflow-x-auto rounded-2xl bg-black/40 p-4 text-sm text-sky-300"><code>{'curl -H "X-API-Key: <your-secret-key>" \\\n  /api/v1/projects?page=1&limit=20'}</code></pre></section></div>
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-bold text-white">{content.endpoints}</h2><div className="mt-5 grid gap-3">{content.rows.map(([method, path, description]) => <div key={`${method}-${path}`} className="grid gap-2 rounded-2xl bg-black/20 p-4 md:grid-cols-[5rem_20rem_1fr]"><span className="font-black text-emerald-400">{method}</span><code className="break-all text-sky-300">{path}</code><span className="text-slate-300">{description}</span></div>)}</div></section>
    <section className="mt-6 rounded-3xl border border-amber-400/20 bg-amber-400/5 p-6"><h2 className="text-xl font-bold text-white">{content.reliability}</h2><p className="mt-3 leading-7 text-slate-300">{content.reliabilityBody}</p></section>
    <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/api/v1/docs" className="rounded-xl bg-emerald-400 px-5 py-3 text-center font-bold text-slate-950">{content.schema}</Link><Link href="/developer" className="rounded-xl border border-white/15 px-5 py-3 text-center font-bold">{content.console}</Link><Link href="/" className="rounded-xl px-5 py-3 text-center font-bold text-slate-300">{content.back}</Link></div><p className="mt-8 border-t border-white/10 pt-6 text-sm leading-6 text-slate-400">{content.notice}</p>
  </article></main>;
}
