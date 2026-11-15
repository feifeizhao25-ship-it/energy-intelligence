import { Plan } from './plans';

export type Payment = { id: string; orderNo?: string | null; amount: number | string; currency: string; description?: string | null; paidAt?: string | null; createdAt: string };
export type Member = {
    id: string; name?: string | null; email: string; plan: Plan; effectivePlan: Plan; nextResetAt: string; planExpireAt?: string | null;
    dailyAiCalls: number; dailyResourceQueries: number; dailyCalculations: number;
    dailyPaperSearches: number; dailyDiagnoses: number; projectCount: number;
    paperCount: number; stationCount: number; folderCount: number;
    paymentPagination?: { page: number; nextPage: number | null; nextCursor: string | null };
    subscription?: { status: string; endDate: string; autoRenew: boolean; scheduledPlan?: string | null; payments: Payment[] } | null;
};

function validMember(value: unknown): value is Member {
    if (!value || typeof value !== 'object') return false;
    const data = value as Record<string, any>;
    const counts = ['dailyAiCalls', 'dailyResourceQueries', 'dailyCalculations', 'dailyPaperSearches', 'dailyDiagnoses', 'projectCount', 'paperCount', 'stationCount', 'folderCount'];
    return typeof data.id === 'string' && data.id.length > 0
        && Object.values(Plan).includes(data.plan) && Object.values(Plan).includes(data.effectivePlan)
        && typeof data.nextResetAt === 'string' && Number.isFinite(Date.parse(data.nextResetAt))
        && counts.every(key => Number.isInteger(data[key]) && data[key] >= 0)
        && (data.planExpireAt == null || (typeof data.planExpireAt === 'string' && Number.isFinite(Date.parse(data.planExpireAt))))
        && (data.paymentPagination == null || (typeof data.paymentPagination === 'object'
            && (data.paymentPagination.nextCursor === null || (typeof data.paymentPagination.nextCursor === 'string' && data.paymentPagination.nextCursor.length > 0))))
        && (!data.subscription || (Array.isArray(data.subscription.payments) && data.subscription.payments.every((p: any) =>
            p && typeof p.id === 'string' && (typeof p.amount === 'number' || (typeof p.amount === 'string' && p.amount.trim() !== ''))
            && Number.isFinite(Number(p.amount)) && Number(p.amount) >= 0 && typeof p.currency === 'string'
            && (p.description == null || typeof p.description === 'string') && Number.isFinite(Date.parse(p.createdAt))
            && (p.paidAt == null || Number.isFinite(Date.parse(p.paidAt))))));
}

/** Bounded reads, with Chinese errors even for proxy HTML or offline fetch errors. */
export async function loadMember(url: string, signal?: AbortSignal): Promise<Member> {
    const controller = new AbortController();
    let timedOut = false;
    const cancel = () => controller.abort();
    if (signal?.aborted) cancel();
    signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
    try {
        let response: Response;
        try { response = await fetch(url, { cache: 'no-store', signal: controller.signal }); }
        catch {
            if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
            throw new Error(timedOut ? '会员信息读取超时，请重试' : '网络连接失败，请检查网络后重试');
        }
        if (response.status === 401) throw new Error('登录已失效，请重新登录后重试');
        if (!response.ok) throw new Error('会员信息暂时无法读取，请重试');
        let body;
        try { body = await response.json(); } catch {
            if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
            throw new Error(timedOut ? '会员信息读取超时，请重试' : '会员信息响应格式异常，请重试');
        }
        if (body?.success !== true || !validMember(body.data)) throw new Error('会员信息不完整，请重试');
        return body.data;
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
    }
}
