import { ragMaxAgeDays, validateRagMetadata } from './rag-metadata';

const now = new Date('2026-09-01T12:00:00.000Z');
const base = { title: '政策原文', userId: 'u1', sourceUrl: 'https://gov.example.cn/policy' };

describe('RAG 来源时效契约', () => {
    it('接受有效且在时效窗口内的来源', () => {
        expect(validateRagMetadata({ ...base, retrievedAt: '2026-08-20T00:00:00Z' }, now, 30)).toMatchObject({ status: 'current', maxAgeDays: 30 });
    });

    it('拒绝过期、未来和非法检索日期', () => {
        expect(() => validateRagMetadata({ ...base, retrievedAt: '2026-06-01T00:00:00Z' }, now, 30)).toThrow('已过期');
        expect(() => validateRagMetadata({ ...base, retrievedAt: '2026-09-02T00:00:00Z' }, now, 30)).toThrow('晚于当前时间');
        expect(() => validateRagMetadata({ ...base, retrievedAt: 'not-a-date' }, now, 30)).toThrow('日期无效');
    });

    it('拒绝非 HTTPS 来源和未来发布时间', () => {
        expect(() => validateRagMetadata({ ...base, sourceUrl: 'http://example.com', retrievedAt: '2026-09-01T00:00:00Z' }, now, 30)).toThrow('HTTPS');
        expect(() => validateRagMetadata({ ...base, retrievedAt: '2026-09-01T00:00:00Z', sourcePublishedAt: '2026-09-03T00:00:00Z' }, now, 30)).toThrow('发布时间');
    });

    it('拒绝错误的环境时效配置', () => {
        expect(() => ragMaxAgeDays('0')).toThrow('1 到 3650');
        expect(() => ragMaxAgeDays('30.5')).toThrow('1 到 3650');
    });
});
