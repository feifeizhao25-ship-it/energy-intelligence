import fs from 'fs';
import path from 'path';

// 使用项目根目录下的 .exports 文件夹存储临时文件
const EXPORT_DIR = path.join(process.cwd(), '.exports');

// 确保目录存在
if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

/**
 * 添加到磁盘缓存
 */
export function addToExportCache(
    filename: string,
    data: { content: Buffer | string; format: string; contentType: string }
) {
    const filePath = path.join(EXPORT_DIR, filename);
    const metaPath = path.join(EXPORT_DIR, `${filename}.meta.json`);

    fs.writeFileSync(filePath, data.content);
    fs.writeFileSync(metaPath, JSON.stringify({
        contentType: data.contentType,
        format: data.format,
        createdAt: Date.now()
    }));

    // 10 分钟后自动清理 (简单实现，实际生产环境建议用定时任务)
    setTimeout(() => {
        try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
        } catch (e) { }
    }, 10 * 60 * 1000);
}

/**
 * 从磁盘缓存获取数据
 */
export function getFromExportCache(filename: string) {
    const filePath = path.join(EXPORT_DIR, filename);
    const metaPath = path.join(EXPORT_DIR, `${filename}.meta.json`);

    if (!fs.existsSync(filePath) || !fs.existsSync(metaPath)) {
        return null;
    }

    const content = fs.readFileSync(filePath);
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

    return {
        content,
        ...meta
    };
}
