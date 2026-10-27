import { generateSmsCode } from '@/lib/auth/sms-verify';
import Core from '@alicloud/pop-core';

function smsSettings() {
    return {
        accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID?.trim() || '',
        accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET?.trim() || '',
        signName: process.env.ALIYUN_SMS_SIGN_NAME?.trim() || '新能源智库',
        templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE?.trim() || '',
    };
}

/** live：密钥和模板都在；mock：仅开发环境；unconfigured：其余环境必须显式失败。 */
export function smsDeliveryMode(): 'live' | 'mock' | 'unconfigured' {
    const { accessKeyId, accessKeySecret, templateCode } = smsSettings();
    if (accessKeyId && accessKeySecret && templateCode) return 'live';
    if (process.env.NODE_ENV === 'development') return 'mock';
    return 'unconfigured';
}

// 懒加载 client - 避免在没有 Key 时 build 失败
let client: Core | null = null;
function getClient() {
    const { accessKeyId, accessKeySecret } = smsSettings();
    if (!client && accessKeyId && accessKeySecret) {
        client = new Core({
            accessKeyId,
            accessKeySecret,
            endpoint: 'https://dysmsapi.aliyuncs.com',
            apiVersion: '2017-05-25'
        });
    }
    return client;
}

/**
 * 发送短信验证码
 * @param phone 手机号
 * @param code 验证码
 */
export async function sendVerificationCode(phone: string, code: string) {
    const mode = smsDeliveryMode();
    if (mode === 'unconfigured') {
        return { success: false, code: 'SMS_NOT_CONFIGURED', error: '短信服务未配置' };
    }
    if (mode === 'mock') {
        console.log(`[SMS MOCK] To: ${phone}, Code: ${code}`);
        return { success: true, mock: true };
    }
    const { signName, templateCode } = smsSettings();

    const params = {
        "RegionId": "cn-hangzhou",
        "PhoneNumbers": phone,
        "SignName": signName,
        "TemplateCode": templateCode,
        "TemplateParam": JSON.stringify({ code })
    };

    const requestOption = {
        method: 'POST',
        formatParams: false,
    };

    try {
        const smsClient = getClient();
        if (!smsClient) {
            console.error('Aliyun SMS: Client not initialized. Missing API keys.');
            return { success: false, error: '短信服务未配置' };
        }
        const result = await smsClient.request('SendSms', params, requestOption);
        // @ts-ignore
        if (result.Code === 'OK') {
            return { success: true, data: result };
        } else {
            // @ts-ignore
            throw new Error(result.Message || '发送失败');
        }
    } catch (error: any) {
        console.error('Aliyun SMS Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 生成 6 位随机验证码
 */
export function generateCode() {
    // 用密码学安全随机数（原来是 Math.random）
    return generateSmsCode();
}
