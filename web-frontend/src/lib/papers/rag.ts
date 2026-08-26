import { aiService } from '../ai/unified';
import { supabase } from '../supabase';
const pdf = require('pdf-parse');

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
            // 1. 解析 PDF
            const data = await pdf(buffer);
            const text = data.text;

            // 2. 文本分块 (每块约 500 字符，重叠 100 字符)
            const chunks = this.chunkText(text, 500, 100);

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
                    documentId,
                    chunkIndex: i,
                    totalChunks: chunks.length
                }
            }));

            const { error } = await supabase
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

            const { data, error } = await supabase.rpc('match_document_chunks', {
                query_embedding: queryEmbedding,
                match_threshold: 0.5,
                match_count: limit,
                filter: searchFilter
            });

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('[RAG] Search Error:', error);
            return [];
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
