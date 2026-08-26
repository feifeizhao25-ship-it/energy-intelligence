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

/**
 * 提示词注入基础防护：PDF 提取文本进入分块/向量库（最终进入 LLM 上下文）前，
 * 对已知注入模式做检测 + 中和标记。不阻断正常内容——仅把命中的注入指令
 * 片段替换为占位标记，并记录命中片段供审计。
 */
const INJECTION_PATTERNS: RegExp[] = [
    /ignore\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|directions?)/gi,
    /disregard\s+(all\s+|any\s+|the\s+)?(previous|prior|above)\s+(instructions?|prompts?|directions?)/gi,
    /forget\s+(all\s+|the\s+)?(previous|prior|above)\s+(instructions?|prompts?)/gi,
    /you\s+are\s+now\s+(a|an)\s+[^.\n]{0,40}?(assistant|ai|model|bot)/gi,
    /(new|override)\s+system\s+(prompt|instructions?)\s*:/gi,
    /忽略(之前|上述|以上|先前|所有)[^，。；\n]{0,12}(指令|指示|要求|提示)/g,
    /无视(之前|上述|以上|所有)[^，。；\n]{0,12}(指令|指示|要求)/g,
    /忘记(之前|上述|以上|所有)[^，。；\n]{0,12}(指令|指示)/g,
];

export const INJECTION_PLACEHOLDER = '[已过滤：疑似提示词注入]';

export interface InjectionScan {
    /** 中和后的文本（未命中时与输入一致） */
    text: string;
    /** 是否命中过注入模式 */
    flagged: boolean;
    /** 被中和的注入片段原文（供日志审计） */
    matches: string[];
}

/** 检测并中和文本中的已知提示词注入模式。 */
export function neutralizePromptInjections(text: string): InjectionScan {
    let sanitized = text;
    const matches: string[] = [];
    for (const pattern of INJECTION_PATTERNS) {
        pattern.lastIndex = 0; // 全局正则复用前重置游标
        const found = sanitized.match(pattern);
        if (found) matches.push(...found);
        pattern.lastIndex = 0;
        sanitized = sanitized.replace(pattern, INJECTION_PLACEHOLDER);
    }
    return { text: sanitized, flagged: matches.length > 0, matches };
}
