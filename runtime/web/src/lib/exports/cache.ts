import fs from 'fs';
import path from 'path';

const EXPORT_DIR = path.join(process.cwd(), '.exports');
const MAX_AGE_MS = 10 * 60 * 1000;
/** 正在写的临时文件超过这段时间没有更新，视为崩溃残留。长导出期间文件修改时间会更新。 */
const PARTIAL_GRACE_MS = 15 * 60 * 1000;
/** 正文已改名但元数据还没写上的窗口很短；超过这个时间仍缺元数据就是崩溃残留。 */
const ORPHAN_GRACE_MS = 60 * 1000;
const PARTIAL_NAME = /^\.[0-9a-f-]{36}\.partial$/i;
const DATA_NAME = /^[A-Za-z0-9_-]+\.(csv|json)$/;
const META_NAME = /^[A-Za-z0-9_-]+\.(csv|json)\.meta\.json$/;

export function exportDirectory() {
    return EXPORT_DIR;
}

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
    scheduleRemoval(target.filePath, target.metaPath);
}

function scheduleRemoval(...files: string[]) {
    const timer = setTimeout(() => {
        for (const file of files) {
            try { fs.unlinkSync(file); } catch { /* Already removed or unavailable. */ }
        }
    }, MAX_AGE_MS);
    timer.unref();
}

export function publishPartial(
    partialPath: string,
    filename: string,
    data: { format: string; contentType: string; ownerId: string },
) {
    const target = locations(filename);
    const partialBase = path.basename(partialPath);
    if (!target || !data.ownerId || !PARTIAL_NAME.test(partialBase) || path.dirname(path.resolve(partialPath)) !== path.resolve(EXPORT_DIR)) {
        throw new Error('导出文件参数无效');
    }
    fs.renameSync(partialPath, target.filePath);
    try {
        fs.writeFileSync(target.metaPath, JSON.stringify({
            ownerId: data.ownerId, contentType: data.contentType,
            format: data.format, createdAt: Date.now(),
        }), { flag: 'wx', mode: 0o600 });
    } catch (error) {
        try { fs.unlinkSync(target.filePath); } catch { /* The body is unusable without its owner record. */ }
        throw error;
    }
    scheduleRemoval(target.filePath, target.metaPath);
}

export function discardPartial(partialPath: string, filename?: string) {
    const partialBase = path.basename(partialPath);
    if (PARTIAL_NAME.test(partialBase) && path.dirname(path.resolve(partialPath)) === path.resolve(EXPORT_DIR)) {
        try { fs.unlinkSync(partialPath); } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
    }
    if (filename) removeFromExportCache(filename);
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

export function openExportReadStream(filename: string, ownerId: string) {
    const target = locations(filename);
    if (!target || !ownerId) return null;
    try {
        const meta = JSON.parse(fs.readFileSync(target.metaPath, 'utf8'));
        const age = Date.now() - meta.createdAt;
        if (meta.ownerId !== ownerId || !Number.isFinite(meta.createdAt) || age < 0 || age >= MAX_AGE_MS) return null;
        return {
            stream: fs.createReadStream(target.filePath),
            contentType: String(meta.contentType),
            format: String(meta.format),
        };
    } catch {
        return null;
    }
}

/** 启动和定时清理：崩溃留下的半成品，以及进程退出后没人删的过期导出。 */
export function sweepExportDirectory(dir: string, now = Date.now()) {
    let names: string[] = [];
    try { names = fs.readdirSync(dir); } catch { return []; }
    const removed: string[] = [];
    const unlink = (name: string) => {
        if (name !== path.basename(name) || name.includes('..')) return;
        const full = path.join(dir, name);
        let fileStat: fs.Stats;
        try { fileStat = fs.lstatSync(full); } catch { return; }
        if (!fileStat.isFile()) return;
        try { fs.unlinkSync(full); removed.push(name); } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
    };
    for (const name of names) {
        if (name !== path.basename(name) || name.includes('..')) continue;
        let stat: fs.Stats;
        try { stat = fs.lstatSync(path.join(dir, name)); } catch { continue; }
        if (!stat.isFile()) continue;
        const age = now - stat.mtimeMs;
        if (PARTIAL_NAME.test(name)) {
            if (age >= PARTIAL_GRACE_MS) unlink(name);
            continue;
        }
        if (META_NAME.test(name)) {
            const dataName = name.slice(0, -'.meta.json'.length);
            let createdAt = Number.NaN;
            try { createdAt = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')).createdAt; } catch { createdAt = Number.NaN; }
            const expired = Number.isFinite(createdAt) && now - createdAt >= MAX_AGE_MS;
            if (expired) {
                unlink(name);
                unlink(dataName);
                continue;
            }
            const unreadable = !Number.isFinite(createdAt);
            if ((unreadable || !fs.existsSync(path.join(dir, dataName))) && age >= ORPHAN_GRACE_MS) unlink(name);
            continue;
        }
        if (!DATA_NAME.test(name)) continue;
        const metaPath = path.join(dir, `${name}.meta.json`);
        if (!fs.existsSync(metaPath)) {
            if (age >= ORPHAN_GRACE_MS) unlink(name);
            continue;
        }
        try {
            const createdAt = JSON.parse(fs.readFileSync(metaPath, 'utf8')).createdAt;
            if (Number.isFinite(createdAt) && now - createdAt >= MAX_AGE_MS) unlink(name);
        } catch {
            if (age >= ORPHAN_GRACE_MS) unlink(name);
        }
    }
    return removed;
}

let sweepStarted = false;
export function startExportSweep() {
    sweepExportDirectory(EXPORT_DIR);
    if (sweepStarted || process.env.NODE_ENV === 'test') return;
    sweepStarted = true;
    const timer = setInterval(() => {
        try { sweepExportDirectory(EXPORT_DIR); } catch (error) {
            console.error('导出临时文件清理失败', error);
        }
    }, 60_000);
    timer.unref();
}

/** Remove only a generated export; never accept a path from the caller. */
export function removeFromExportCache(filename: string) {
    const target = locations(filename);
    if (!target) return;
    for (const file of [target.filePath, target.metaPath]) {
        try { fs.unlinkSync(file); } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
    }
}
