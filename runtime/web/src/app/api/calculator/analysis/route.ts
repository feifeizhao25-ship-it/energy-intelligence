import { NextRequest, NextResponse } from 'next/server';
import { simpleChat } from '@/lib/ai/unified';

export async function POST(req: NextRequest) {
    try {
        const { type, data } = await req.json();

        if (!data) {
            return NextResponse.json({ error: 'Missing data' }, { status: 400 });
        }

        const typeLabel = type === 'solar' ? '分布式光伏' : type === 'wind' ? '分散式风电' : '工商业储能';
        const metrics = data.financial.metrics || data.financial;

        const prompt = `
    请作为专业的新能源投资顾问，分析以下${typeLabel}项目的测算指标，并给出3条精准的评价建议。
    
    指标数据：
    - IRR: ${metrics.irr?.toFixed(2)}%
    - 回收期: ${metrics.paybackYears?.toFixed(1)}年
    - 度电成本: ${metrics.lcoe || metrics.lcos}
    - 装机容量: ${data.metadata?.capacity} kWp
    - 地区: ${data.metadata?.province}
    
    要求：
    1. 语气专业、严谨。
    2. 第一条关注财务收益率是否达标。
    3. 第二条关注资源稳健性或地区政策风险。
    4. 第三条给出明确的“建议推进”或“需进一步调研”结论。
    5. 总字数控制在200字以内，Markdown 列表格式。
    `;

        const analysis = await simpleChat(prompt, 'deepseek-v3');

        return NextResponse.json({ results: analysis });
    } catch (error: any) {
        console.error('AI Analysis Error:', error);
        return NextResponse.json({ error: 'Failed to generate analysis' }, { status: 500 });
    }
}
