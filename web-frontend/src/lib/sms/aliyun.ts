import Core from '@alicloud/pop-core';

const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
const signName = process.env.ALIYUN_SMS_SIGN_NAME || '新能源智库';
const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE;

// 懒加载 client - 避免在没有 Key 时 build 失败
let client: Core | null = null;
function getClient() {
    if (!client && accessKeyId && accessKeySecret) {
        client = new Core({
            accessKeyId: accessKeyId,
            accessKeySecret: accessKeySecret,
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
    // 如果是开发环境且没有配置 Key，则直接打印日志并返回成功
    if (process.env.NODE_ENV === 'development' && (!accessKeyId || !accessKeySecret)) {
        console.log(`[SMS MOCK] To: ${phone}, Code: ${code}`);
        return { success: true, mock: true };
    }

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
    return Math.floor(100000 + Math.random() * 900000).toString();
}
