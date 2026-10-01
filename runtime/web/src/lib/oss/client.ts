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

/** 用户文件在 OSS 里的统一前缀：uploadToOSS 的调用方必须把用户文件放在这个前缀下，注销时按前缀整体删除。 */
export function userFilePrefix(userId: string): string {
    return `users/${userId}/`;
}

interface OssLike {
    list(query: { prefix: string; marker?: string; 'max-keys'?: number }, options?: object): Promise<{ objects?: { name: string }[]; isTruncated?: boolean; nextMarker?: string }>;
    deleteMulti(names: string[], options?: { quiet?: boolean }): Promise<unknown>;
}

/**
 * 注销账号时删除该用户在 OSS 里的全部文件（上传的文献 PDF 等）。
 *
 * 原来注销只删数据库行，OSS 里用户上传的 PDF 原文件原样留着，与「删除个人信息」的承诺不符。
 * 未配置 OSS 时（没有存过文件）返回 0；删除失败会抛错，调用方应中止注销、让用户稍后重试，
 * 而不是先删库再留下无人认领的文件。
 */
export async function deleteUserFiles(userId: string, client: OssLike | null = getClient() as unknown as OssLike | null): Promise<number> {
    if (!client) return 0;
    const prefix = userFilePrefix(userId);
    let deleted = 0;
    let marker: string | undefined;
    do {
        const page = await client.list({ prefix, marker, 'max-keys': 1000 });
        const names = (page.objects ?? []).map((o) => o.name).filter((n) => n.startsWith(prefix));
        if (names.length) {
            await client.deleteMulti(names, { quiet: true });
            deleted += names.length;
        }
        marker = page.isTruncated ? page.nextMarker : undefined;
    } while (marker);
    return deleted;
}
