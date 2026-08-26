import OSS from 'ali-oss';

// 懒加载 OSS client - 避免在没有 Key 时 build 失败
let ossClient: OSS | null = null;

function getClient() {
    if (!ossClient && process.env.ALIYUN_ACCESS_KEY_ID && process.env.ALIYUN_ACCESS_KEY_SECRET) {
        ossClient = new OSS({
            region: process.env.ALIYUN_OSS_REGION || 'oss-cn-beijing',
            accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
            accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
            bucket: process.env.ALIYUN_OSS_BUCKET || 'solarwind-assets',
            secure: true,
        });
    }
    return ossClient;
}

/**
 * 上传文件到阿里云 OSS
 * @param path 存储路径 (例如: projects/123/report.pdf)
 * @param fileBuffer 文件内容
 */
export async function uploadToOSS(path: string, fileBuffer: Buffer | ReadableStream | Blob) {
    // 开发环境下如果没有配置 Key，则直接返回模拟 URL
    if (process.env.NODE_ENV === 'development' && (!process.env.ALIYUN_ACCESS_KEY_ID)) {
        console.log(`[OSS MOCK] Uploading to: ${path}`);
        return {
            url: `https://mock-oss.xinnengyuan.ai/${path}`,
            success: true
        };
    }

    try {
        const client = getClient();
        if (!client) {
            return { success: false, error: 'OSS client not configured', url: '' };
        }
        const result = await client.put(path, fileBuffer);
        return {
            url: result.url,
            success: true,
            data: result
        };
    } catch (error: any) {
        console.error('OSS Upload Error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 获取文件临时访问链接 (适用于私有 Bucket)
 */
export async function getSignedUrl(path: string, expires: number = 3600) {
    if (process.env.NODE_ENV === 'development' && (!process.env.ALIYUN_ACCESS_KEY_ID)) {
        return `https://mock-oss.xinnengyuan.ai/${path}?token=mock`;
    }

    try {
        const client = getClient();
        if (!client) return null;
        const url = client.signatureUrl(path, { expires });
        return url;
    } catch (error) {
        console.error('OSS Sign Error:', error);
        return null;
    }
}
