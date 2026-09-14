/** Only controlled copy reaches the UI; upstream bodies may contain private diagnostics. */
export async function readCalculationResponse(response: Response): Promise<unknown> {
    if (!response.ok) {
        const messages: Record<number, string> = {
            401: '请先登录，再提交测算。',
            403: '当前账户暂不能使用此测算，请检查会员权益。',
            429: '请求过于频繁或测算额度已用完，请稍后重试或查看会员权益。',
        };
        throw new Error(messages[response.status] ?? '测算服务暂不可用，未取得结果，请稍后再试。');
    }
    let result;
    try { result = await response.json(); }
    catch { throw new Error('测算结果格式异常，请稍后再试。'); }
    if (result?.success !== true || !result.data || typeof result.data !== 'object' || Array.isArray(result.data)) {
        throw new Error('未取得完整测算结果，请核对输入后重试。');
    }
    return result.data;
}
