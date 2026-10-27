/**
 * 政策抓取的礼貌规则：如实声明身份（不伪装浏览器）、先读 robots.txt、同一站点限速。
 *
 * robots.txt 解析按 RFC 9309：按 User-agent 分组，优先匹配本爬虫的产品名，否则用 `*`；
 * Allow/Disallow 取最长匹配，长度相同时 Allow 优先；支持 `*` 通配和 `$` 结尾。
 * 读不到 robots.txt：404/410 视为不限制；401/403、5xx、网络错误一律视为禁止（保守处理）。
 */

export const CRAWLER_PRODUCT = 'XinNengYuanZhiKu-PolicyBot';

export function crawlerContact(): string {
    return (process.env.CRAWLER_CONTACT_EMAIL || '').trim();
}

export function crawlerUserAgent(): string {
    const contact = (crawlerContact() || process.env.OPENALEX_CONTACT_EMAIL || '').trim();
    return `${CRAWLER_PRODUCT}/1.0 (新能源智库政策收录；只抓取政府公开栏目；${contact ? `联系 ${contact}` : '遵守 robots.txt'})`;
}

interface Rule { allow: boolean; pattern: string }
export interface RobotsRules { rules: Rule[]; disallowAll?: boolean }

export function parseRobots(text: string, product: string = CRAWLER_PRODUCT): RobotsRules {
    const groups: { agents: string[]; rules: Rule[] }[] = [];
    let current: { agents: string[]; rules: Rule[] } | null = null;
    let lastWasAgent = false;
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.replace(/#.*$/, '').trim();
        if (!line) continue;
        const idx = line.indexOf(':');
        if (idx < 0) continue;
        const key = line.slice(0, idx).trim().toLowerCase();
        const value = line.slice(idx + 1).trim();
        if (key === 'user-agent') {
            if (!current || !lastWasAgent) { current = { agents: [], rules: [] }; groups.push(current); }
            current.agents.push(value.toLowerCase());
            lastWasAgent = true;
            continue;
        }
        lastWasAgent = false;
        if (!current) continue;
        if (key === 'allow' || key === 'disallow') {
            if (key === 'disallow' && value === '') continue; // 空 Disallow 表示不限制
            current.rules.push({ allow: key === 'allow', pattern: value });
        }
    }
    const token = product.toLowerCase();
    const specific = groups.filter(g => g.agents.some(a => a !== '*' && token.includes(a)));
    const chosen = specific.length ? specific : groups.filter(g => g.agents.includes('*'));
    return { rules: chosen.flatMap(g => g.rules) };
}

function patternToRegex(pattern: string): RegExp {
    const anchored = pattern.endsWith('$');
    const body = (anchored ? pattern.slice(0, -1) : pattern)
        .split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

export function isPathAllowed(robots: RobotsRules, pathWithQuery: string): boolean {
    if (robots.disallowAll) return false;
    let best: Rule | null = null;
    for (const rule of robots.rules) {
        if (!patternToRegex(rule.pattern).test(pathWithQuery)) continue;
        if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow)) best = rule;
    }
    return best ? best.allow : true;
}

type Fetcher = typeof fetch;

/** 每个站点的 robots.txt 缓存 + 最小请求间隔 */
export class PoliteFetcher {
    private robotsCache = new Map<string, RobotsRules>();
    private lastRequestAt = new Map<string, number>();

    constructor(
        private readonly fetcher: Fetcher = (...args) => fetch(...args),
        private readonly minIntervalMs = 2000,
        private readonly sleep: (ms: number) => Promise<void> = ms => new Promise(r => setTimeout(r, ms)),
    ) {}

    private async throttle(origin: string) {
        const last = this.lastRequestAt.get(origin);
        const wait = last === undefined ? 0 : this.minIntervalMs - (Date.now() - last);
        if (wait > 0) await this.sleep(wait);
        this.lastRequestAt.set(origin, Date.now());
    }

    async robotsFor(origin: string): Promise<RobotsRules> {
        const cached = this.robotsCache.get(origin);
        if (cached) return cached;
        let rules: RobotsRules;
        try {
            await this.throttle(origin);
            const res = await this.fetcher(`${origin}/robots.txt`, { headers: { 'User-Agent': crawlerUserAgent() }, redirect: 'follow' });
            if (res.status === 404 || res.status === 410) rules = { rules: [] };
            else if (!res.ok) rules = { rules: [], disallowAll: true };
            else rules = parseRobots(await res.text());
        } catch {
            rules = { rules: [], disallowAll: true };
        }
        this.robotsCache.set(origin, rules);
        return rules;
    }

    async canFetch(url: string): Promise<boolean> {
        const u = new URL(url);
        return isPathAllowed(await this.robotsFor(u.origin), `${u.pathname}${u.search}`);
    }

    /** 先查 robots.txt，再以真实 UA 抓取；被 robots 禁止时抛出 ROBOTS_DISALLOWED，不抓页面 */
    async get(url: string): Promise<Response> {
        if (!crawlerContact()) throw new Error('CRAWLER_CONTACT_REQUIRED');
        if (!(await this.canFetch(url))) throw new Error(`ROBOTS_DISALLOWED: ${url}`);
        await this.throttle(new URL(url).origin);
        return this.fetcher(url, { headers: { 'User-Agent': crawlerUserAgent() } });
    }
}
