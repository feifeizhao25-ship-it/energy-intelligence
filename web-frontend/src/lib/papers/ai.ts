import { simpleChat } from '../ai/unified';

/**
 * 生成论文中文摘要
 */
export async function generateSummary(abstract: string, title: string): Promise<string> {
    const prompt = `
    请作为学术助手，阅读以下论文摘要，并生成结构化的中文摘要。
    
    论文标题：${title}
    原文摘要：${abstract}
    
    请按以下格式输出（保留Markdown格式）：
    
    ### 研究背景
    (简述背景)
    
    ### 主要方法
    (简述方法)
    
    ### 核心结论
    (列出3点主要结论)
    
    ### 实际意义
    (对新能源领域的应用价值)
    `;

    return await simpleChat(prompt); // Adjust temperature/model in unified if needed
}

/**
 * 提取关键数据
 */
export async function extractKeyData(content: string): Promise<any[]> {
    const prompt = `
    请从以下论文片段中提取关键技术指标和数据。
    重点关注：效率(Efficiency)、衰减率(Degradation)、成本(Cost/LCOE)、电压/电流参数等。
    
    文本内容：${content.substring(0, 2000)}...
    
    请返回 JSON 数组格式：
    [
        { "label": "电池效率", "value": "25.8%", "context": "TOPCon电池..." },
        ...
    ]
    `;

    try {
        const raw = await simpleChat(prompt);
        return JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch (e) {
        return [];
    }
}

/**
 * 术语解释
 */
export async function explainTerm(term: string, context: string): Promise<string> {
    const prompt = `
    解释学术术语："${term}"。
    上下文：${context}
    
    请给出：
    1. 全称 (英文)
    2. 中文名称
    3. 简懂解释 (50字以内)
    `;

    return await simpleChat(prompt);
}

/**
 * 翻译文本
 */
export async function translateText(text: string): Promise<string> {
    const prompt = `
    请将以下学术文本精准翻译成中文，保持专业术语的准确性：
    
    "${text}"
    `;
    return await simpleChat(prompt);
}

/**
 * 生成全文/分段对照翻译
 */
export async function generateFullTranslation(text: string): Promise<any[]> {
    const prompt = `
    你是一个专业学术翻译引擎。请将提供的学术文本（包含标题、摘要等）进行分段翻译。
    
    输入文本：
    ${text}
    
    要求：
    1. 识别文本结构（如标题、摘要、背景、方法、结论等）。
    2. 提供中英文对照，其中英文为原文（或通过原文润色），中文为专业翻译。
    3. 返回 JSON 数组格式：
    [
        { "section": "标题", "en": "Original Title", "zh": "中文标题" },
        { "section": "摘要", "en": "Original Abstract sentence...", "zh": "摘要翻译..." },
        { "section": "研究意义", "en": "Significance...", "zh": "..." }
    ]
    4. 确保 JSON 格式合法，不要包含 Markdown 标记。
    `;

    try {
        const raw = await simpleChat(prompt, 'deepseek-v3');
        return JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch (e) {
        console.error('Translation parse error', e);
        // Fallback
        return [{ section: "原文", en: text, zh: "翻译生成失败，请重试。" }];
    }
}
