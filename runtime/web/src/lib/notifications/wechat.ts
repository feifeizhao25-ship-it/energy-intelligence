/**
 * 微信服务号通知推送服务
 */

export interface WeChatNotifyRequest {
    openId: string;
    templateId: string;
    data: Record<string, string>;
    url?: string;
}

// 缓存 AccessToken
let cachedToken: { token: string; expireAt: number } | null = null;

/**
 * 获取及缓存微信 AccessToken
 */
async function getWeChatAccessToken(): Promise<string | null> {
    const appId = process.env.WECHAT_APP_ID;
    const appSecret = process.env.WECHAT_APP_SECRET;

    if (!appId || !appSecret) {
        console.error('WeChat AppID/Secret missing');
        return null;
    }

    // 检查缓存
    if (cachedToken && cachedToken.expireAt > Date.now()) {
        return cachedToken.token;
    }

    try {
        const res = await fetch(
            `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`
        );
        const data = await res.json();

        if (data.access_token) {
            cachedToken = {
                token: data.access_token,
                expireAt: Date.now() + (data.expires_in - 200) * 1000 // 提前 200 秒更新
            };
            return data.access_token;
        }
        return null;
    } catch (err) {
        console.error('Failed to get WeChat AccessToken:', err);
        return null;
    }
}

/**
 * 发送微信模板消息
 */
export async function sendWeChatNotification(req: WeChatNotifyRequest) {
    // 1. 开发环境模拟
    if (process.env.NODE_ENV === 'development') {
        console.log(`[WECHAT MOCK] Sending to ${req.openId}: ${JSON.stringify(req.data)}`);
        return { success: true, mock: true };
    }

    // 2. 获取端点 Token
    const token = await getWeChatAccessToken();
    if (!token) {
        return { success: false, error: 'Failed to acquire access token' };
    }

    // 3. 构造微信要求的模板数据格式
    const formattedData: Record<string, any> = {};
    Object.keys(req.data).forEach(key => {
        formattedData[key] = { value: req.data[key], color: "#173177" };
    });

    try {
        const res = await fetch(
            `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${token}`,
            {
                method: 'POST',
                body: JSON.stringify({
                    touser: req.openId,
                    template_id: req.templateId,
                    url: req.url,
                    data: formattedData
                })
            }
        );

        const result = await res.json();
        if (result.errcode === 0) {
            return { success: true, messageId: result.msgid };
        } else {
            console.error('WeChat API Error:', result);
            return { success: false, error: result.errmsg };
        }
    } catch (err: any) {
        console.error('WeChat Notification Fetch Error:', err);
        return { success: false, error: err.message };
    }
}
