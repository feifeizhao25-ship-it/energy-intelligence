import fs from 'fs';
import path from 'path';

const EXPORT_DIR = path.join(process.cwd(), '.exports');
const MAX_AGE_MS = 10 * 60 * 1000;

function locations(filename: string) {
    if (!/^[A-Za-z0-9_-]+\.(csv|json)$/.test(filename)) return null;
    return { filePath: path.join(EXPORT_DIR, filename), metaPath: path.join(EXPORT_DIR, `${filename}.meta.json`) };
}

export function addToExportCache(
    filename: string,
    data: { content: Buffer | string; format: string; contentType: string; ownerId: string }
) {
    const target = locations(filename);
    if (!target || !data.ownerId) throw new Error('导出文件参数无效');
    fs.mkdirSync(EXPORT_DIR, { recursive: true, mode: 0o700 });
    fs.writeFileSync(target.filePath, data.content, { flag: 'wx', mode: 0o600 });
    try {
        fs.writeFileSync(target.metaPath, JSON.stringify({
            ownerId: data.ownerId, contentType: data.contentType,
            format: data.format, createdAt: Date.now(),
        }), { flag: 'wx', mode: 0o600 });
    } catch (error) {
        fs.unlinkSync(target.filePath);
        throw error;
    }
    const timer = setTimeout(() => {
        for (const file of [target.filePath, target.metaPath]) {
            try { fs.unlinkSync(file); } catch { /* Already removed or unavailable. */ }
        }
    }, MAX_AGE_MS);
    timer.unref();
}

export function getFromExportCache(filename: string, ownerId: string) {
    const target = locations(filename);
    if (!target || !ownerId) return null;
    try {
        const meta = JSON.parse(fs.readFileSync(target.metaPath, 'utf8'));
        const age = Date.now() - meta.createdAt;
        if (meta.ownerId !== ownerId || !Number.isFinite(meta.createdAt) || age < 0 || age >= MAX_AGE_MS) return null;
        // Authorization and expiry are checked before reading any report content.
        return { content: fs.readFileSync(target.filePath), contentType: meta.contentType, format: meta.format };
    } catch {
        return null;
    }
}
