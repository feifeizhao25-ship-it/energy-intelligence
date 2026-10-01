import { safeErrorMessage } from '@/lib/api/safe-error';
/** Only controlled copy reaches the UI; upstream bodies may contain private diagnostics. */
export async function readCalculationResponse(response: Response): Promise<unknown> {
    if (!response.ok) {
        const messages: Record<number, string> = {
            401: '请先登录，再提交测算。',
            403: '当前账户暂不能使用此测算，请检查会员权益。',
            429: '请求过于频繁或测算额度已用完，请稍后重试或查看会员权益。',
        };
        const generic = messages[response.status] ?? '测算服务暂不可用，未取得结果，请稍后再试。';
        // 会员权益/额度类拒绝（403/429）服务端会给出具体中文原因（「今日收益测算次数已用完（2 次）……」），
        // 比泛泛的「额度已用完」有用；其余状态仍不透传响应体。safeErrorMessage 会挡掉英文和内部报错。
        if (response.status === 403 || response.status === 429) {
            const body = await response.clone().json().catch(() => null);
            throw new Error(safeErrorMessage(typeof body?.message === 'string' ? new Error(body.message) : null, generic));
        }
        throw new Error(generic);
    }
    let result;
    try { result = await response.json(); }
    catch { throw new Error('测算结果格式异常，请稍后再试。'); }
    if (result?.success !== true || !result.data || typeof result.data !== 'object' || Array.isArray(result.data)) {
        throw new Error('未取得完整测算结果，请核对输入后重试。');
    }
    return result.data;
}
