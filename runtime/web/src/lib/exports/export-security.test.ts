import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { addToExportCache, getFromExportCache } from './cache';
import { escapeCsvCell } from './csv';
import { POST } from '@/app/api/exports/route';
import { prisma } from '@/lib/prisma';
import { GET } from '@/app/api/exports/download/[filename]/route';

jest.mock('@/lib/prisma', () => ({ prisma: { project: { findMany: jest.fn() }, calculation: { findMany: jest.fn() } } }));
jest.mock('@/lib/audit/quota', () => ({ consumeQuota: jest.fn().mockResolvedValue({ success: true }) }));
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));

const files: string[] = [];
function report() {
    const filename = `security_${randomUUID()}.csv`;
    files.push(filename);
    addToExportCache(filename, { ownerId: 'owner', content: '私密项目数据', contentType: 'text/csv', format: 'csv' });
    return filename;
}
afterEach(() => {
    jest.restoreAllMocks();
    for (const filename of files.splice(0)) {
        for (const suffix of ['', '.meta.json']) {
            fs.rmSync(path.join(process.cwd(), '.exports', filename + suffix), { force: true });
        }
    }
});

test('only the owner receives a private non-cacheable download', async () => {
    const filename = report();
    const request = new NextRequest('http://localhost/api/exports/download/' + filename);
    (getServerSession as jest.Mock).mockResolvedValue(null);
    expect((await GET(request, { params: Promise.resolve({ filename }) })).status).toBe(401);
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'another-user' } });
    const denied = await GET(request, { params: Promise.resolve({ filename }) });
    expect(denied.status).toBe(404);
    expect(await denied.text()).not.toContain('私密项目数据');
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner' } });
    const response = await GET(request, { params: Promise.resolve({ filename }) });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('私密项目数据');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
});

test.each(['expired', 'legacy', 'corrupt'])('rejects %s metadata without relying on cleanup timers', (kind) => {
    const filename = report();
    const metaPath = path.join(process.cwd(), '.exports', filename + '.meta.json');
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (kind === 'expired') meta.createdAt = Date.now() - 600001;
    if (kind === 'legacy') delete meta.ownerId;
    fs.writeFileSync(metaPath, kind === 'corrupt' ? '{' : JSON.stringify(meta));
    expect(getFromExportCache(filename, 'owner')).toBeNull();
});

test.each(['../private.csv', '/private.csv', '..%2Fprivate.csv', 'file.csv\r\nInjected:1'])('rejects unsafe filename %s before reading disk', (filename) => {
    const read = jest.spyOn(fs, 'readFileSync');
    expect(getFromExportCache(filename, 'owner')).toBeNull();
    expect(read).not.toHaveBeenCalled();
});

test('cannot overwrite another export with the same filename', () => {
    const filename = report();
    expect(() => addToExportCache(filename, { ownerId: 'another', content: 'replacement', format: 'csv', contentType: 'text/csv' })).toThrow();
    expect(getFromExportCache(filename, 'owner')?.content.toString()).toBe('私密项目数据');
});

test.each(['=1+1', '+SUM(A1)', '-1+2', '@SUM(A1)', '  =1+1', '\t=1+1'])('neutralizes spreadsheet formula text %s', (value) => {
    expect(escapeCsvCell(value)).toBe("'" + value);
});

test('preserves numeric zero and negatives, and escapes delimiters', () => {
    expect(escapeCsvCell(0)).toBe('0');
    expect(escapeCsvCell(-12)).toBe('-12');
    expect(escapeCsvCell('项目,"甲"')).toBe('"项目,""甲"""');
});


test('same-millisecond exports have unique filenames and bind the authenticated owner', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner' } });
    (prisma.project.findMany as jest.Mock).mockResolvedValue([{ id: 'project', name: '=1+1', type: 'SOLAR', capacity: 0, lng: 0, lat: 0, createdAt: new Date() }]);
    jest.spyOn(Date, 'now').mockReturnValue(Date.now());
    const names = [];
    for (let index = 0; index < 2; index++) {
        const response = await POST(new NextRequest('http://localhost/api/exports', { method: 'POST', body: JSON.stringify({ dataType: 'projects', format: 'csv', userId: 'another-user' }) }));
        expect(response.status).toBe(200);
        const body = await response.json();
        files.push(body.data.filename);
        names.push(body.data.filename);
        const cached = getFromExportCache(body.data.filename, 'owner');
        expect(cached?.content.toString()).toContain("'=1+1");
        expect(body.data.size).toBe(cached?.content.length);
        expect(getFromExportCache(body.data.filename, 'another-user')).toBeNull();
    }
    expect(new Set(names).size).toBe(2);
    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'owner' } }));
});

test('zero generation remains zero in exported data', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner' } });
    (prisma.calculation.findMany as jest.Mock).mockResolvedValue([{ id: 'calculation', type: 'SOLAR', input: {}, output: { energy: { annualGeneration: 0 } }, createdAt: new Date() }]);
    const response = await POST(new NextRequest('http://localhost/api/exports', { method: 'POST', body: JSON.stringify({ dataType: 'calculations', format: 'json' }) }));
    expect(response.status).toBe(200);
    const body = await response.json();
    files.push(body.data.filename);
    const cached = getFromExportCache(body.data.filename, 'owner');
    expect(JSON.parse(cached!.content.toString())[0]['年发电量(kWh)']).toBe(0);
});
