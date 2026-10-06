import { parseRobots, isPathAllowed, PoliteFetcher, crawlerUserAgent, CRAWLER_PRODUCT } from './robots';
import { PolicyCrawler } from './policy-crawler';

jest.mock('@/lib/ai/unified', () => ({ simpleChat: jest.fn() }));

const ROBOTS = `
User-agent: *
Disallow: /admin/
Disallow: /*.pdf$
Allow: /admin/public/

User-agent: BadBot
Disallow: /
`;

describe('robots.txt 解析', () => {
    const rules = parseRobots(ROBOTS);
    it.each([
        ['/zwgk/zcwj/index.html', true],
        ['/admin/secret.html', false],
        ['/admin/public/notice.html', true],
        ['/files/a.pdf', false],
        ['/files/a.pdf?x=1', true],
    ])('%s → %s', (path, allowed) => {
        expect(isPathAllowed(rules, path)).toBe(allowed);
    });

    it('有本爬虫专属分组时用专属分组', () => {
        const own = parseRobots(`User-agent: *\nDisallow:\n\nUser-agent: ${CRAWLER_PRODUCT}\nDisallow: /`);
        expect(isPathAllowed(own, '/index.html')).toBe(false);
    });
});

function fakeFetch(robots: { status: number; body?: string }) {
    const calls: { url: string; ua: string }[] = [];
    const fn = jest.fn(async (url: any, init?: any) => {
        calls.push({ url: String(url), ua: init?.headers?.['User-Agent'] });
        if (String(url).endsWith('/robots.txt')) {
            return new Response(robots.body ?? '', { status: robots.status });
        }
        return new Response('<html><body>政策正文</body></html>', { status: 200 });
    });
    return { fn: fn as unknown as typeof fetch, calls };
}

describe('PoliteFetcher：先查 robots，真实 UA，不伪装浏览器', () => {
    const noSleep = async () => {};

    it('robots 禁止的页面不抓，只请求了 robots.txt', async () => {
        const { fn, calls } = fakeFetch({ status: 200, body: 'User-agent: *\nDisallow: /' });
        const polite = new PoliteFetcher(fn, 0, noSleep);
        await expect(polite.get('https://fgw.example.gov.cn/zcwj/1.html')).rejects.toThrow('ROBOTS_DISALLOWED');
        expect(calls.map(c => c.url)).toEqual(['https://fgw.example.gov.cn/robots.txt']);
    });

    it('robots 允许时抓取，UA 是本爬虫名而不是 Chrome/Mozilla', async () => {
        const { fn, calls } = fakeFetch({ status: 200, body: ROBOTS });
        const crawler = new PolicyCrawler(new PoliteFetcher(fn, 0, noSleep));
        expect(await crawler.fetchPageContent('https://fgw.example.gov.cn/zcwj/1.html')).toContain('政策正文');
        for (const c of calls) {
            expect(c.ua).toContain(CRAWLER_PRODUCT);
            expect(c.ua).not.toMatch(/Mozilla|Chrome|Safari/);
        }
        expect(crawlerUserAgent()).not.toMatch(/Mozilla/);
    });

    it('robots.txt 404 视为不限制；403、5xx、网络错误一律视为禁止', async () => {
        expect(await new PoliteFetcher(fakeFetch({ status: 404 }).fn, 0, noSleep).canFetch('https://a.gov.cn/x')).toBe(true);
        expect(await new PoliteFetcher(fakeFetch({ status: 403 }).fn, 0, noSleep).canFetch('https://a.gov.cn/x')).toBe(false);
        expect(await new PoliteFetcher(fakeFetch({ status: 503 }).fn, 0, noSleep).canFetch('https://a.gov.cn/x')).toBe(false);
        const broken = jest.fn(async () => { throw new Error('ECONNRESET'); }) as unknown as typeof fetch;
        expect(await new PoliteFetcher(broken, 0, noSleep).canFetch('https://a.gov.cn/x')).toBe(false);
    });

    it('同一站点连续请求之间等待最小间隔；robots.txt 按站点缓存', async () => {
        const { fn, calls } = fakeFetch({ status: 404 });
        const sleeps: number[] = [];
        const polite = new PoliteFetcher(fn, 2000, async (ms) => { sleeps.push(ms); });
        await polite.get('https://a.gov.cn/1');
        await polite.get('https://a.gov.cn/2');
        expect(calls.filter(c => c.url.endsWith('/robots.txt'))).toHaveLength(1);
        expect(sleeps.length).toBeGreaterThan(0);
        expect(Math.max(...sleeps)).toBeLessThanOrEqual(2000);
    });
});
