/**
 * 企业预约演示 — 字段校验与防重复提交测试。
 */

import {
    validateDemoRequest,
    isDuplicateRequest,
    DEDUPE_WINDOW_HOURS,
} from './validation';

const VALID = {
    name: '张三',
    company: '某某新能源开发有限公司',
    email: 'zhangsan@example.com',
};

describe('validateDemoRequest', () => {
    it('接受合法的最小请求', () => {
        const result = validateDemoRequest(VALID);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data).toEqual({ ...VALID });
            expect(result.data.phone).toBeUndefined();
            expect(result.data.message).toBeUndefined();
        }
    });

    it('接受带选填字段的请求并去除首尾空白', () => {
        const result = validateDemoRequest({
            ...VALID,
            phone: ' 138-0000-0000 ',
            message: ' 想了解私有化部署 ',
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data.phone).toBe('138-0000-0000');
            expect(result.data.message).toBe('想了解私有化部署');
        }
    });

    it('拒绝非对象请求体', () => {
        for (const body of [null, undefined, 42, 'x', [1], true]) {
            expect(validateDemoRequest(body).ok).toBe(false);
        }
    });

    it('拒绝缺少必填字段的请求', () => {
        for (const key of ['name', 'company', 'email'] as const) {
            const body = { ...VALID, [key]: '' };
            const result = validateDemoRequest(body);
            expect(result.ok).toBe(false);
        }
    });

    it('拒绝非法邮箱', () => {
        for (const email of ['not-an-email', 'a@b', '@x.com', 'a b@c.com']) {
            expect(validateDemoRequest({ ...VALID, email }).ok).toBe(false);
        }
    });

    it('邮箱统一转小写', () => {
        const result = validateDemoRequest({ ...VALID, email: 'ZhangSan@Example.COM' });
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.data.email).toBe('zhangsan@example.com');
    });

    it('拒绝非法电话', () => {
        expect(validateDemoRequest({ ...VALID, phone: 'abcdefg' }).ok).toBe(false);
        expect(validateDemoRequest({ ...VALID, phone: '1' }).ok).toBe(false);
    });

    it('拒绝超长字段（防滥用）', () => {
        expect(validateDemoRequest({ ...VALID, name: 'x'.repeat(51) }).ok).toBe(false);
        expect(validateDemoRequest({ ...VALID, company: 'x'.repeat(101) }).ok).toBe(false);
        expect(validateDemoRequest({ ...VALID, message: 'x'.repeat(501) }).ok).toBe(false);
    });

    it('忽略非字符串字段而不是崩溃', () => {
        const result = validateDemoRequest({ ...VALID, phone: 12345, message: { x: 1 } });
        expect(result.ok).toBe(true);
    });
});

describe('isDuplicateRequest', () => {
    const now = new Date('2026-08-21T08:00:00Z');

    it('无历史请求时不重复', () => {
        expect(isDuplicateRequest(null, now)).toBe(false);
    });

    it('窗口期内的请求视为重复', () => {
        const recent = new Date(now.getTime() - 60 * 60 * 1000); // 1 小时前
        expect(isDuplicateRequest({ createdAt: recent }, now)).toBe(true);
    });

    it('窗口期外的请求不视为重复', () => {
        const old = new Date(now.getTime() - (DEDUPE_WINDOW_HOURS + 1) * 60 * 60 * 1000);
        expect(isDuplicateRequest({ createdAt: old }, now)).toBe(false);
    });

    it('未来时间戳不按重复处理（时钟异常防护）', () => {
        const future = new Date(now.getTime() + 60 * 1000);
        expect(isDuplicateRequest({ createdAt: future }, now)).toBe(false);
    });
});
