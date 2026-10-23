import fs from 'fs';
import { finished } from 'stream/promises';
import { randomUUID } from 'crypto';
import path from 'path';
import { escapeCsvCell } from './csv';
import { exportDirectory } from './cache';

export const EXPORT_PAGE_SIZE = 200;

export type ExportRow = { id: string; cells: unknown[] };

function watchStream(stream: fs.WriteStream) {
    let failed: Error | undefined;
    stream.on('error', (error: Error) => { failed ??= error; });
    return () => failed;
}

async function push(stream: fs.WriteStream, text: string, failed: () => Error | undefined) {
    const pending = failed();
    if (pending) throw pending;
    const chunk = Buffer.from(text);
    if (!stream.write(chunk)) {
        const writeError = failed();
        if (writeError) throw writeError;
        await new Promise<void>((resolve, reject) => {
            const onDrain = () => { cleanup(); resolve(); };
            const onError = (error: Error) => { cleanup(); reject(error); };
            const cleanup = () => {
                stream.off('drain', onDrain);
                stream.off('error', onError);
            };
            stream.once('drain', onDrain);
            stream.once('error', onError);
        });
    }
    return chunk.length;
}

/** 按行写入临时文件，不把整份导出让进内存。失败时删除半成品。 */
export async function writeTabularExport(options: {
    format: 'csv' | 'json';
    headers: string[];
    loadPage: (cursor: string | undefined) => Promise<ExportRow[]>;
    pageSize?: number;
}) {
    const pageSize = options.pageSize ?? EXPORT_PAGE_SIZE;
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new Error('导出分页参数无效');
    const dir = exportDirectory();
    await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
    const partialPath = path.join(dir, `.${randomUUID()}.partial`);
    let stream: fs.WriteStream | undefined;
    let bytes = 0;
    let records = 0;
    const sample: unknown[][] = [];
    try {
        stream = fs.createWriteStream(partialPath, { flags: 'wx', mode: 0o600 });
        const failed = watchStream(stream);
        const write = async (text: string) => { bytes += await push(stream!, text, failed); };
        if (options.format === 'csv') {
            await write(`\uFEFF${options.headers.map(escapeCsvCell).join(',')}`);
        } else {
            await write('[');
        }
        let cursor: string | undefined;
        let first = true;
        for (;;) {
            const page = await options.loadPage(cursor);
            for (const row of page) {
                if (sample.length < 3) sample.push(row.cells);
                if (options.format === 'csv') {
                    await write(`\n${row.cells.map(escapeCsvCell).join(',')}`);
                } else {
                    const obj: Record<string, unknown> = {};
                    options.headers.forEach((header, index) => { obj[header] = row.cells[index]; });
                    await write(`${first ? '' : ','}${JSON.stringify(obj)}`);
                    first = false;
                }
                records += 1;
            }
            if (page.length < pageSize) break;
            const next = page[page.length - 1]?.id;
            if (!next || next === cursor) break;
            cursor = next;
        }
        if (options.format === 'json') await write(']');
        stream.end();
        await finished(stream);
        return { partialPath, bytes, records, sample };
    } catch (error) {
        stream?.destroy();
        await fs.promises.unlink(partialPath).catch(() => undefined);
        throw error;
    }
}
