jest.mock('@/lib/prisma', () => ({ prisma: {} }));
jest.mock('../papers/rag', () => ({
    ragProcessor: {
        searchContext: jest.fn(async () => [
            { content: '倾角宜按全年发电量最大确定。', metadata: { documentId: 'd1', title: 'GB 50797-2012 光伏发电站设计规范', sourceUrl: 'https://www.mohurd.gov.cn/gb50797' } },
        ]),
    },
}));
import { executeTool } from './tool-executor';
import { collectSourcesFromToolResult, verifySources } from '@/lib/evidence/verification';

test('知识库检索结果带 [S1] 编号和来源，网页端能收集成引用', async () => {
    const result: any = await executeTool('query_knowledge_base', { query: 'GB50797 倾角', userId: 'u1' });
    expect(result.context).toContain('[S1] GB 50797-2012 光伏发电站设计规范');
    const sources = collectSourcesFromToolResult('query_knowledge_base', result);
    expect(sources).toEqual([expect.objectContaining({ url: 'https://www.mohurd.gov.cn/gb50797', title: 'GB 50797-2012 光伏发电站设计规范', tool: 'query_knowledge_base' })]);
    expect(verifySources(sources).reason).not.toBe('本次回答未调用带来源的工具，内容基于模型知识');
});
