import { NextRequest, NextResponse } from 'next/server';
import { simpleChat } from '@/lib/ai/unified';

/**
 * AI 研究助手 API
 * 提供文献总结、对比分析、研究方向建议等功能
 */

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { task, papers, query, context } = body;

    try {
        let prompt = '';
        let result: any = {};

        switch (task) {
            case 'summarize':
                // 总结单篇或多篇文献
                prompt = `
作为一名专业的研究助手，请对以下文献进行总结：

${papers.map((p: any, i: number) => `
## 文献 ${i + 1}: ${p.title}
作者: ${p.authors?.join(', ') || '未知'}
年份: ${p.year || '未知'}
${p.abstract ? `摘要: ${p.abstract}` : ''}
`).join('\n')}

请提供：
1. 核心观点和主要贡献
2. 研究方法和数据
3. 主要发现和结论
4. 局限性和未来方向

以简洁、结构化的方式回答，每个部分用 3-5 个要点。
`;
                const summary = await simpleChat(prompt, 'deepseek-v3');
                result = {
                    task: 'summarize',
                    summary,
                    papersCount: papers.length
                };
                break;

            case 'compare':
                // 对比分析多篇文献
                prompt = `
作为研究专家，请对比分析以下文献：

${papers.map((p: any, i: number) => `
### 文献 ${i + 1}: ${p.title}
- 作者: ${p.authors?.join(', ') || '未知'}
- 年份: ${p.year}
- 主要内容: ${p.abstract?.substring(0, 200) || '未提供'}
`).join('\n')}

请从以下维度进行对比：
1. 研究方法的异同
2. 数据规模和类型
3. 主要发现的一致性和差异
4. 创新点对比
5. 应用场景差异

以表格或结构化格式呈现对比结果。
`;
                const comparison = await simpleChat(prompt, 'deepseek-v3');
                result = {
                    task: 'compare',
                    comparison,
                    papersCompared: papers.length
                };
                break;

            case 'suggest_research':
                // 研究方向建议
                prompt = `
基于以下研究领域和已有文献：

领域: ${query || '新能源与人工智能'}

已有研究:
${papers.map((p: any) => `- ${p.title} (${p.year})`).join('\n')}

${context ? `背景信息: ${context}` : ''}

请提供：
1. 3-5 个有前景的研究方向
2. 每个方向的研究价值和可行性
3. 建议的研究方法
4. 可能的创新点
5. 相关的数据集或资源

请具体且可操作。
`;
                const suggestions = await simpleChat(prompt, 'deepseek-v3');
                result = {
                    task: 'suggest_research',
                    suggestions,
                    basedOn: papers.length
                };
                break;

            case 'extract_insights':
                // 提取关键洞察
                prompt = `
从以下文献中提取关键洞察和趋势：

${papers.map((p: any) => `
- ${p.title} (${p.year})
  ${p.abstract?.substring(0, 150) || ''}
`).join('\n')}

请识别：
1. 主要研究趋势（3-5 个）
2. 关键技术演进
3. 未解决的问题
4. 未来发展方向
5. 跨学科连接点

以要点形式回答，每点附简短说明。
`;
                const insights = await simpleChat(prompt, 'deepseek-v3');
                result = {
                    task: 'extract_insights',
                    insights,
                    analyzedPapers: papers.length
                };
                break;

            case 'literature_review':
                // 生成文献综述大纲
                prompt = `
为以下主题生成文献综述大纲：

主题: ${query}

参考文献:
${papers.map((p: any, i: number) => `
${i + 1}. ${p.title} - ${p.authors?.[0] || 'Unknown'} et al. (${p.year})
`).join('\n')}

请提供：
1. 综述结构（章节标题）
2. 每个章节的要点
3. 文献分类建议
4. 需要补充的文献类型
5. 写作建议

格式化为可直接使用的大纲。
`;
                const outline = await simpleChat(prompt, 'deepseek-v3');
                result = {
                    task: 'literature_review',
                    outline,
                    topic: query,
                    referencesCount: papers.length
                };
                break;

            default:
                return NextResponse.json({
                    success: false,
                    error: `Unknown task: ${task}`
                }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            data: result
        });

    } catch (error: any) {
        console.error('Research assistant error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to process request'
        }, { status: 500 });
    }
}
