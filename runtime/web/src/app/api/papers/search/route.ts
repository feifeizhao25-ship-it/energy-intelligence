import { NextRequest, NextResponse } from 'next/server';
import { unifiedSearch } from '@/lib/papers/search';
import { enforceRateLimit, PUBLIC_RULES } from '@/lib/security/rate-limit';
import { acquireMember } from '@/lib/membership/middleware';

export async function POST(request: NextRequest) {
    const limited = await enforceRateLimit(request, PUBLIC_RULES.papers);
    if (limited) return limited;

    const body = await request.json().catch(() => null);
    if (!body || typeof body.query !== 'string' || !body.query.trim() || body.query.length > 2000) {
        return NextResponse.json({ error: '请输入有效的检索词，最多 2000 个字符' }, { status: 400 });
    }
    if (body.options != null && (typeof body.options !== 'object' || Array.isArray(body.options))) {
        return NextResponse.json({ error: '检索选项格式不正确' }, { status: 400 });
    }
    const options = body.options ?? {};
    const currentYear = new Date().getFullYear();
    const validYear = (value: unknown) => value === undefined ||
        (typeof value === 'number' && Number.isInteger(value) && value >= 1800 && value <= currentYear);
    if ((options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 100)) ||
        (options.offset !== undefined && (!Number.isInteger(options.offset) || options.offset < 0 || options.offset > 9999)) ||
        !validYear(options.yearFrom) || !validYear(options.yearTo) ||
        (options.yearFrom !== undefined && options.yearTo !== undefined && options.yearFrom > options.yearTo) ||
        (options.openAccess !== undefined && typeof options.openAccess !== 'boolean')) {
        return NextResponse.json({ error: '请检查检索数量、年份范围和开放获取选项' }, { status: 400 });
    }
    // 原来不登录就能搜，且每次搜索都可能先调一次大模型改写检索词：免费版「每日 3 次文献检索」
    // 只是文案，匿名请求还能白用站点的模型额度。现在要求登录并按会员档扣减每日检索次数。
    const acquired = await acquireMember({ usageType: 'paper_search' });
    if (!acquired.ok) return acquired.response;
    try {
        const result = await unifiedSearch(body.query.trim(), { ...options, userId: acquired.user.id });
        return NextResponse.json({ success: true, data: result });
    } catch {
        await acquired.refund();
        return NextResponse.json(
            { error: '学术数据源暂时不可用，请稍后重试', code: 'UPSTREAM_UNAVAILABLE' },
            { status: 503 }
        );
    }
}
