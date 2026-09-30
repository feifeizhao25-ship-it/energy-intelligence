import { aiService } from '../ai/unified';
import { prisma } from '@/lib/prisma';
import { PDFParse } from 'pdf-parse';
import { assertValidPdfBuffer, neutralizePromptInjections } from './pdf-guard';
import { validateRagMetadata } from './rag-metadata';

/**
 * 余弦相似度。维度不一致、零向量一律视为不相关（返回 -1），不抛错。
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (!a.length || a.length !== b.length) return -1;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return -1;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** 单次检索最多比对多少块：单用户文献库的量级，超过则只取最近的，避免拖垮进程。 */
const MAX_SCAN_CHUNKS = 20000;

/**
 * PDF RAG 处理器
 * 负责解析、分块、向量化和检索。
 *
 * 向量存在自建 PostgreSQL（document_chunks 表，Prisma），检索在应用内做余弦相似度。
 * 国内版不接境外托管数据库（Supabase 已移除）；不依赖 pgvector 扩展，
 * 现有 postgres:16-alpine 镜像即可运行。
 */
export const ragProcessor = {
    /**
     * 处理 PDF 并存入向量库
     */
    async indexPdf(buffer: Buffer, documentId: string, metadata: any = {}) {
        try {
            const freshness = validateRagMetadata(metadata);
            // 0. 安全校验：大小限制 + 魔数检查，恶意/超大文件在此被拒绝
            assertValidPdfBuffer(buffer);

            // 1. 解析 PDF（解析失败一律转为明确错误，不向外泄露解析器内部信息）
            const text = await this.extractText(buffer);

            // 1.5 提示词注入防护：中和已知注入模式（标记不阻断），命中记录告警日志
            const scan = neutralizePromptInjections(text);
            if (scan.flagged) {
                console.warn(`[RAG] Neutralized ${scan.matches.length} suspected prompt-injection fragment(s) in PDF text`);
            }

            // 2. 文本分块 (每块约 500 字符，重叠 100 字符)
            const chunks = this.chunkText(scan.text, 500, 100);

            console.log(`[RAG] Split PDF into ${chunks.length} chunks`);

            // 3. 批量生成向量
            // 硅基流动支持批量 Embedding
            const embeddings = await aiService.createEmbedding(chunks);

            // 4. 存入自建 PostgreSQL：先清掉同一用户同一文档的旧块（重复索引不累积），再写入
            const ownerId = metadata?.userId;
            if (typeof ownerId !== 'string' || !ownerId) throw new Error('RAG 索引缺少 userId');
            if (embeddings.length !== chunks.length) throw new Error('向量数量与文本块数量不一致');
            const rows = chunks.map((content, i) => ({
                userId: ownerId,
                documentId,
                chunkIndex: i,
                content,
                embedding: embeddings[i],
                metadata: {
                    ...metadata,
                    retrievedAt: freshness.retrievedAt,
                    freshness,
                    documentId,
                    chunkIndex: i,
                    totalChunks: chunks.length
                }
            }));

            await prisma.$transaction(async (tx) => {
                await tx.documentChunk.deleteMany({ where: { userId: ownerId, documentId } });
                await tx.documentChunk.createMany({ data: rows });
            });

            return { success: true, chunks: chunks.length };
        } catch (error) {
            console.error('[RAG] Indexing Error:', error);
            throw error;
        }
    },

    /**
     * 检索相关上下文
     */
    async searchContext(query: string, documentId?: string, limit: number = 5, filter: { userId?: string; documentId?: string } = {}) {
        try {
            // 0. 只检索本人数据：没有 userId 就不查库（fail-closed）
            const userId = filter?.userId;
            if (typeof userId !== 'string' || !userId) return [];

            // 1. 生成查询向量
            const [queryEmbedding] = await aiService.createEmbedding([query]);

            // 2. 取出本人的块（可限定文档），在应用内按余弦相似度排序
            const scopedDocumentId = documentId ?? filter?.documentId;
            const rows = await prisma.documentChunk.findMany({
                where: scopedDocumentId ? { userId, documentId: scopedDocumentId } : { userId },
                select: { id: true, documentId: true, chunkIndex: true, content: true, embedding: true, metadata: true },
                orderBy: { createdAt: 'desc' },
                take: MAX_SCAN_CHUNKS,
            });

            return rows
                .map((row) => ({
                    id: row.id,
                    content: row.content,
                    metadata: (row.metadata ?? {}) as Record<string, any>,
                    similarity: cosineSimilarity(queryEmbedding, row.embedding),
                }))
                .filter((chunk) => chunk.similarity >= 0.5)
                .filter((chunk) => {
                    if (chunk.metadata.userId !== userId) return false;
                    try {
                        // 用户自己上传的文件没有「重新抓取」一说，不按检索日期过期
                        validateRagMetadata(chunk.metadata.source === 'upload'
                            ? { ...chunk.metadata, retrievedAt: new Date().toISOString() }
                            : chunk.metadata);
                        return true;
                    } catch {
                        return false;
                    }
                })
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, limit);
        } catch (error) {
            console.error('[RAG] Search Error:', error);
            throw error;
        }
    },

    /**
     * 提取 PDF 文本。损坏/加密/格式不受支持的文件抛出统一错误（fail-closed）。
     */
    async extractText(buffer: Buffer): Promise<string> {
        const parser = new PDFParse({ data: buffer });
        try {
            const result = await parser.getText();
            const text = result.text || '';
            if (!text.trim()) throw new Error('PDF 未包含可提取的文本内容');
            return text;
        } catch (error: any) {
            if (error?.message === 'PDF 未包含可提取的文本内容') throw error;
            throw new Error('PDF 解析失败：文件损坏、已加密或格式不受支持');
        } finally {
            await parser.destroy().catch(() => undefined);
        }
    },

    /**
     * 文本分块逻辑
     */
    chunkText(text: string, chunkSize: number, chunkOverlap: number): string[] {
        const chunks: string[] = [];
        const cleanText = text.replace(/\s+/g, ' ').trim();

        for (let i = 0; i < cleanText.length; i += (chunkSize - chunkOverlap)) {
            chunks.push(cleanText.slice(i, i + chunkSize));
            if (i + chunkSize >= cleanText.length) break;
        }

        return chunks;
    }
};
