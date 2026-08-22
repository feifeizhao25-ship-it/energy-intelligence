/**
 * PDF 上传/解析安全校验（纯函数，便于单测）。
 *
 * 三道防线：大小限制、MIME 类型校验、魔数（%PDF-）校验。
 * MIME 由客户端声明、可伪造，因此必须再核对文件头魔数。
 */

export const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25MB

const PDF_MAGIC = Buffer.from('%PDF-', 'ascii');

export interface PdfRejection {
    status: number;
    error: string;
}

export class PdfValidationError extends Error {
    status: number;
    constructor(rejection: PdfRejection) {
        super(rejection.error);
        this.name = 'PdfValidationError';
        this.status = rejection.status;
    }
}

/**
 * 校验 PDF 缓冲。通过返回 null，拒绝返回 { status, error }。
 * mimeType 传 undefined 表示调用方未声明（仅做大小与魔数校验）。
 */
export function validatePdfBuffer(buffer: Buffer | null | undefined, mimeType?: string): PdfRejection | null {
    if (!buffer || buffer.length === 0) {
        return { status: 400, error: 'PDF 文件为空' };
    }
    if (buffer.length > MAX_PDF_BYTES) {
        return { status: 413, error: 'PDF 文件不能超过 25MB' };
    }
    if (mimeType !== undefined && mimeType !== 'application/pdf') {
        return { status: 415, error: '仅支持 PDF 文件' };
    }
    if (buffer.length < PDF_MAGIC.length || !buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
        return { status: 422, error: '文件内容不是合法的 PDF' };
    }
    return null;
}

/** 校验失败时抛 PdfValidationError（供解析链路 fail-closed 使用）。 */
export function assertValidPdfBuffer(buffer: Buffer | null | undefined, mimeType?: string): void {
    const rejection = validatePdfBuffer(buffer, mimeType);
    if (rejection) throw new PdfValidationError(rejection);
}
