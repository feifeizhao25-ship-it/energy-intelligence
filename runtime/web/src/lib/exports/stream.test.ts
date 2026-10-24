import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { exportDirectory, sweepExportDirectory } from './cache';
import { writeTabularExport } from './stream';

const partials = () => fs.existsSync(exportDirectory())
    ? fs.readdirSync(exportDirectory()).filter((name) => name.endsWith('.partial'))
    : [];

test('pages through a large table without keeping a partial file after a mid-export failure', async () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({ id: `row-${index}`, cells: [index] }));
    const cursors: Array<string | undefined> = [];
    const written = await writeTabularExport({
        format: 'json',
        headers: ['序号'],
        pageSize: 2,
        loadPage: async (cursor) => {
            cursors.push(cursor);
            const start = cursor ? rows.findIndex((row) => row.id === cursor) + 1 : 0;
            return rows.slice(start, start + 2);
        },
    });
    expect(cursors).toEqual([undefined, 'row-1', 'row-3']);
    expect(JSON.parse(fs.readFileSync(written.partialPath, 'utf8')).map((row: { 序号: number }) => row.序号)).toEqual([0, 1, 2, 3, 4]);
    expect(written.bytes).toBe(fs.statSync(written.partialPath).size);
    fs.unlinkSync(written.partialPath);

    const before = partials();
    await expect(writeTabularExport({
        format: 'csv',
        headers: ['ID'],
        pageSize: 1,
        loadPage: async (cursor) => {
            if (cursor) throw new Error('disk full');
            return [{ id: 'only', cells: ['only'] }];
        },
    })).rejects.toThrow('disk full');
    expect(partials()).toEqual(before);
});

test('a disk error while writing removes the partial and does not wait for drain', async () => {
    const original = fs.createWriteStream;
    const spy = jest.spyOn(fs, 'createWriteStream').mockImplementation(((file, options) => {
        const stream = original.call(fs, file, options);
        const write = stream.write.bind(stream);
        let calls = 0;
        stream.write = ((chunk: unknown, encoding?: unknown, cb?: unknown) => {
            calls += 1;
            if (calls === 1) return write(chunk as never, encoding as never, cb as never);
            process.nextTick(() => stream.emit('error', Object.assign(new Error('disk full'), { code: 'ENOSPC' })));
            return false;
        }) as typeof stream.write;
        return stream;
    }) as typeof fs.createWriteStream);
    const before = partials();
    try {
        await expect(writeTabularExport({
            format: 'json',
            headers: ['序号'],
            pageSize: 1,
            loadPage: async () => [{ id: 'row-0', cells: [1] }],
        })).rejects.toThrow('disk full');
        expect(partials()).toEqual(before);
    } finally {
        spy.mockRestore();
    }
});

test('startup sweep removes crashed partials and expired exports, and keeps files still in use', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-sweep-'));
    const old = new Date(Date.now() - 16 * 60 * 1000);
    const orphanTime = new Date(Date.now() - 2 * 60 * 1000);
    const touch = (name: string, when: Date, body: string) => {
        const full = path.join(dir, name);
        fs.writeFileSync(full, body);
        fs.utimesSync(full, when, when);
    };
    touch(`.${randomUUID()}.partial`, old, 'crashed body');
    const freshPartial = `.${randomUUID()}.partial`;
    fs.writeFileSync(path.join(dir, freshPartial), 'still writing');
    touch('orphan_export.csv', orphanTime, 'no meta');
    fs.writeFileSync(path.join(dir, 'fresh_orphan.csv'), 'just renamed');
    fs.writeFileSync(path.join(dir, 'keep_export.json'), '[]');
    fs.writeFileSync(path.join(dir, 'keep_export.json.meta.json'), JSON.stringify({ createdAt: Date.now(), ownerId: 'owner' }));
    fs.writeFileSync(path.join(dir, 'old_export.json'), '[]');
    fs.writeFileSync(path.join(dir, 'old_export.json.meta.json'), JSON.stringify({ createdAt: Date.now() - 11 * 60 * 1000, ownerId: 'owner' }));
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'leave me');

    const removed = sweepExportDirectory(dir);
    expect(removed).toEqual(expect.arrayContaining([expect.stringMatching(/\.partial$/), 'orphan_export.csv', 'old_export.json', 'old_export.json.meta.json']));
    expect(fs.readdirSync(dir).sort()).toEqual(['fresh_orphan.csv', freshPartial, 'keep_export.json', 'keep_export.json.meta.json', 'notes.txt'].sort());

    fs.writeFileSync(path.join(dir, 'listed_meta_first.json'), '[]');
    fs.writeFileSync(path.join(dir, 'listed_meta_first.json.meta.json'), JSON.stringify({ createdAt: Date.now() - 11 * 60 * 1000, ownerId: 'owner' }));
    const realRead = fs.readdirSync;
    const ordered = jest.spyOn(fs, 'readdirSync').mockImplementation(((target: fs.PathLike) => {
        if (String(target) !== dir) return realRead.call(fs, target);
        return ['listed_meta_first.json.meta.json', 'listed_meta_first.json', 'notes.txt'];
    }) as typeof fs.readdirSync);
    try {
        sweepExportDirectory(dir);
        expect(fs.existsSync(path.join(dir, 'listed_meta_first.json'))).toBe(false);
        expect(fs.existsSync(path.join(dir, 'listed_meta_first.json.meta.json'))).toBe(false);
        expect(fs.existsSync(path.join(dir, 'notes.txt'))).toBe(true);
    } finally {
        ordered.mockRestore();
    }
    expect(fs.readdirSync(dir).sort()).toEqual(['fresh_orphan.csv', freshPartial, 'keep_export.json', 'keep_export.json.meta.json', 'notes.txt'].sort());
    fs.rmSync(dir, { recursive: true, force: true });
});
