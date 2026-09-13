/** 国内硅基流动调用只允许既定端点，不将 API 密钥发送到任意配置地址。 */
export function domesticSiliconFlowBaseUrl(value = process.env.SILICONFLOW_BASE_URL): string {
    const configured = value ?? 'https://api.siliconflow.cn/v1';
    let url: URL;
    try { url = new URL(configured); } catch { throw new Error('国内模型服务地址配置无效'); }
    if (url.protocol !== 'https:' || url.hostname !== 'api.siliconflow.cn' || url.port
        || url.username || url.password || url.search || url.hash || !['/v1', '/v1/'].includes(url.pathname)) {
        throw new Error('国内模型服务地址不在允许范围内');
    }
    return 'https://api.siliconflow.cn/v1';
}
