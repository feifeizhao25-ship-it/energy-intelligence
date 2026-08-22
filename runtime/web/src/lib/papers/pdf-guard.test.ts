/**
 * PDF 上传/解析安全校验测试：大小限制、MIME 校验、魔数检查。
 */

import {
    validatePdfBuffer,
    assertValidPdfBuffer,
    PdfValidationError,
    MAX_PDF_BYTES,
} from './pdf-guard';

const PDF_HEADER = Buffer.from('%PDF-1.7\n...', 'ascii');

describe('validatePdfBuffer', () => {
    it('接受合法的 PDF 缓冲', () => {
        expect(validatePdfBuffer(PDF_HEADER, 'application/pdf')).toBeNull();
    });

    it('拒绝空文件', () => {
        expect(validatePdfBuffer(Buffer.alloc(0), 'application/pdf')).toEqual({
            status: 400, error: 'PDF 文件为空',
        });
        expect(validatePdfBuffer(null, 'application/pdf')).toEqual({
            status: 400, error: 'PDF 文件为空',
        });
    });

    it('拒绝超过 25MB 的文件', () => {
        const big = Buffer.concat([PDF_HEADER, Buffer.alloc(MAX_PDF_BYTES)]);
        const result = validatePdfBuffer(big, 'application/pdf');
        expect(result?.status).toBe(413);
    });

    it('接受恰好等于上限的文件', () => {
        const exact = Buffer.concat([PDF_HEADER, Buffer.alloc(MAX_PDF_BYTES - PDF_HEADER.length)]);
        expect(validatePdfBuffer(exact, 'application/pdf')).toBeNull();
    });

    it('拒绝错误的 MIME 类型', () => {
        expect(validatePdfBuffer(PDF_HEADER, 'application/octet-stream')?.status).toBe(415);
        expect(validatePdfBuffer(PDF_HEADER, 'text/html')?.status).toBe(415);
    });

    it('拒绝伪造 MIME 的非 PDF 内容（魔数检查）', () => {
        // 伪装成 PDF 的可执行文件 / HTML
        const exe = Buffer.from('MZ\x90\x00\x03', 'binary');
        const html = Buffer.from('<html><script>alert(1)</script></html>');
        expect(validatePdfBuffer(exe, 'application/pdf')?.status).toBe(422);
        expect(validatePdfBuffer(html, 'application/pdf')?.status).toBe(422);
    });

    it('拒绝过短、不含完整魔数的文件', () => {
        expect(validatePdfBuffer(Buffer.from('%PD'), 'application/pdf')?.status).toBe(422);
    });

    it('未声明 MIME 时仅做大小与魔数校验', () => {
        expect(validatePdfBuffer(PDF_HEADER)).toBeNull();
        expect(validatePdfBuffer(Buffer.from('not a pdf at all'))?.status).toBe(422);
    });
});

describe('assertValidPdfBuffer', () => {
    it('合法文件不抛异常', () => {
        expect(() => assertValidPdfBuffer(PDF_HEADER, 'application/pdf')).not.toThrow();
    });

    it('非法文件抛出带状态码的 PdfValidationError', () => {
        try {
            assertValidPdfBuffer(Buffer.from('evil'), 'application/pdf');
            throw new Error('should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(PdfValidationError);
            expect((error as PdfValidationError).status).toBe(422);
        }
    });
});
