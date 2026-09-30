/**
 * 文献向量库改走自建 PostgreSQL（Prisma），不再经 Supabase。
 * 用内存替身模拟 document_chunks 表：这里验证的是行为——写入归属、重复索引、
 * 只检索本人数据、相似度排序与阈值、过期来源被过滤、缺少 userId 时不查库。
 */
type Row = { id: string; userId: string; documentId: string; chunkIndex: number; content: string; embedding: number[]; metadata: Record<string, unknown> };

const table: Row[] = [];
const calls: string[] = [];

jest.mock('@/lib/prisma', () => ({
    prisma: {
        $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(mockTx),
        documentChunk: {
            findMany: async ({ where }: { where: { userId: string; documentId?: string } }) => {
                calls.push('findMany');
                return table.filter((r) => r.userId === where.userId && (!where.documentId || r.documentId === where.documentId));
            },
        },
    },
}));
const mockTx = {
    documentChunk: {
        deleteMany: async ({ where }: { where: { userId: string; documentId: string } }) => {
            calls.push('deleteMany');
            for (let i = table.length - 1; i >= 0; i--) {
                if (table[i].userId === where.userId && table[i].documentId === where.documentId) table.splice(i, 1);
            }
        },
        createMany: async ({ data }: { data: Omit<Row, 'id'>[] }) => {
            calls.push('createMany');
            data.forEach((d, i) => table.push({ id: `c${table.length + i}`, ...d }));
            return { count: data.length };
        },
    },
};

const embed = jest.fn(async (input: string[]) => input.map((s) => (s.includes('光伏') ? [1, 0] : [0, 1])));
jest.mock('../ai/unified', () => ({ aiService: { createEmbedding: (i: string[]) => embed(i) } }));

import { ragProcessor } from './rag';

const meta = (over: Record<string, unknown> = {}) => ({
    title: '光伏组件衰减研究', userId: 'u1', sourceUrl: 'https://oss.example.cn/a.pdf',
    retrievedAt: new Date().toISOString(), source: 'upload', ...over,
});
const pdf = Buffer.from('%PDF-1.4 test');

beforeEach(() => {
    table.length = 0; calls.length = 0; embed.mockClear();
    jest.spyOn(ragProcessor, 'extractText').mockResolvedValue('光伏组件衰减。'.repeat(120));
});
afterEach(() => jest.restoreAllMocks());

describe('文献向量库（自建 PostgreSQL）', () => {
    it('索引写入本人名下，每块都带 userId / documentId / 序号', async () => {
        const out = await ragProcessor.indexPdf(pdf, 'doc1', meta());
        expect(out.success).toBe(true);
        expect(table.length).toBe(out.chunks);
        expect(table.every((r) => r.userId === 'u1' && r.documentId === 'doc1')).toBe(true);
        expect(table.map((r) => r.chunkIndex)).toEqual(table.map((_, i) => i));
        expect(table[0].metadata).toMatchObject({ title: '光伏组件衰减研究', totalChunks: out.chunks });
    });

    it('同一文档重新索引先清掉旧块，不会越积越多', async () => {
        const first = await ragProcessor.indexPdf(pdf, 'doc1', meta());
        await ragProcessor.indexPdf(pdf, 'doc1', meta());
        expect(table.length).toBe(first.chunks);
        expect(calls.indexOf('deleteMany')).toBeLessThan(calls.indexOf('createMany'));
    });

    it('缺少 userId 的索引请求被拒绝，不落库', async () => {
        await expect(ragProcessor.indexPdf(pdf, 'doc1', meta({ userId: '' }))).rejects.toThrow();
        expect(table).toHaveLength(0);
    });

    it('检索只看本人的块，按余弦相似度排序并按阈值过滤', async () => {
        table.push(
            { id: 'a', userId: 'u1', documentId: 'd', chunkIndex: 0, content: '光伏', embedding: [1, 0], metadata: meta() },
            { id: 'b', userId: 'u1', documentId: 'd', chunkIndex: 1, content: '风电', embedding: [0, 1], metadata: meta() },
            { id: 'c', userId: 'u1', documentId: 'd', chunkIndex: 2, content: '光伏近似', embedding: [0.9, 0.3], metadata: meta() },
            { id: 'x', userId: 'u2', documentId: 'd', chunkIndex: 0, content: '别人的光伏', embedding: [1, 0], metadata: meta({ userId: 'u2' }) },
        );
        const hits = await ragProcessor.searchContext('光伏', undefined, 5, { userId: 'u1' });
        expect(hits.map((h: { content: string }) => h.content)).toEqual(['光伏', '光伏近似']);
        expect(hits[0].similarity).toBeGreaterThan(hits[1].similarity);
    });

    it('limit 与 documentId 生效', async () => {
        table.push(
            { id: 'a', userId: 'u1', documentId: 'd1', chunkIndex: 0, content: 'A光伏', embedding: [1, 0], metadata: meta() },
            { id: 'b', userId: 'u1', documentId: 'd2', chunkIndex: 0, content: 'B光伏', embedding: [1, 0], metadata: meta() },
        );
        expect(await ragProcessor.searchContext('光伏', 'd2', 5, { userId: 'u1' })).toHaveLength(1);
        expect(await ragProcessor.searchContext('光伏', undefined, 1, { userId: 'u1' })).toHaveLength(1);
    });

    it('没有 userId 时直接返回空，不查库、不调向量接口', async () => {
        expect(await ragProcessor.searchContext('光伏', undefined, 5, {})).toEqual([]);
        expect(calls).not.toContain('findMany');
        expect(embed).not.toHaveBeenCalled();
    });

    it('用户自己上传的文件不按检索日期过期', async () => {
        table.push({ id: 'a', userId: 'u1', documentId: 'd', chunkIndex: 0, content: '光伏', embedding: [1, 0], metadata: meta({ retrievedAt: '2020-01-01T00:00:00Z', source: 'upload' }) });
        expect(await ragProcessor.searchContext('光伏', undefined, 5, { userId: 'u1' })).toHaveLength(1);
    });

    it('来源已过期的块不返回', async () => {
        table.push({ id: 'a', userId: 'u1', documentId: 'd', chunkIndex: 0, content: '光伏', embedding: [1, 0], metadata: meta({ retrievedAt: '2020-01-01T00:00:00Z', source: 'external' }) });
        expect(await ragProcessor.searchContext('光伏', undefined, 5, { userId: 'u1' })).toEqual([]);
    });
});
