import { aiService } from '../ai/unified';
import { requireSupabaseAdmin } from '../supabase';
import { PDFParse } from 'pdf-parse';
import { assertValidPdfBuffer, neutralizePromptInjections } from './pdf-guard';
import { validateRagMetadata } from './rag-metadata';

/**
 * PDF RAG 处理器
 * 负责解析、分块、向量化和检索
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

            // 4. 存入 Supabase
            const rows = chunks.map((content, i) => ({
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

            const { error } = await requireSupabaseAdmin()
                .from('document_chunks')
                .insert(rows);

            if (error) throw error;

            return { success: true, chunks: chunks.length };
        } catch (error) {
            console.error('[RAG] Indexing Error:', error);
            throw error;
        }
    },

    /**
     * 检索相关上下文
     */
    async searchContext(query: string, documentId?: string, limit: number = 5, filter: any = {}) {
        try {
            // 1. 生成查询向量
            const [queryEmbedding] = await aiService.createEmbedding([query]);

            // 2. 向量相似度搜索
            // 如果传入了 documentId 但没入 filter，合并它
            const searchFilter = { ...filter };
            if (documentId) searchFilter.documentId = documentId;

            const { data, error } = await requireSupabaseAdmin().rpc('match_document_chunks', {
                query_embedding: queryEmbedding,
                match_threshold: 0.5,
                match_count: limit,
                filter: searchFilter
            });

            if (error) throw error;

            return (data || []).filter((chunk: any) => {
                if (chunk?.metadata?.userId !== searchFilter.userId) return false;
                try {
                    validateRagMetadata(chunk.metadata);
                    return true;
                } catch {
                    return false;
                }
            });
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
