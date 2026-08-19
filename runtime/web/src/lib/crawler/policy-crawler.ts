import { simpleChat } from '@/lib/ai/unified';
import * as cheerio from 'cheerio';

export interface PolicyData {
    region: string;
    type: 'SUBSIDY_KWH' | 'SUBSIDY_ONE_TIME' | 'ELECTRICITY_PRICE';
    value: number;
    unit: string;
    conditions?: string;
    sourceUrl: string;
    startDate?: Date;
    endDate?: Date;
}

export class PolicyCrawler {
    /**
     * Search for policy documents using web search
     */
    async searchPolicyDocuments(region: string, policyType: 'subsidy' | 'electricity_price'): Promise<string[]> {
        // In a real implementation, this would use a search API (e.g., Google Custom Search, Bing API)
        // For now, we'll return some known government policy URLs

        const knownSources: Record<string, string[]> = {
            '上海': [
                'https://www.shanghai.gov.cn/nw12344/index.html',
                'https://fgw.sh.gov.cn/',
            ],
            '北京': [
                'https://www.beijing.gov.cn/',
                'https://fgw.beijing.gov.cn/',
            ],
            '江苏': [
                'https://www.jiangsu.gov.cn/',
                'https://fgw.jiangsu.gov.cn/',
            ],
            '浙江': [
                'https://www.zj.gov.cn/',
                'https://fzggw.zj.gov.cn/',
            ],
            '广东': [
                'https://www.gd.gov.cn/',
                'https://fzggw.gd.gov.cn/',
            ],
        };

        return knownSources[region] || [];
    }

    /**
     * Fetch webpage content
     */
    async fetchPageContent(url: string): Promise<string> {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.text();
        } catch (error) {
            console.error(`Failed to fetch ${url}:`, error);
            throw error;
        }
    }

    /**
     * Extract text content from HTML
     */
    extractTextFromHtml(html: string): string {
        const $ = cheerio.load(html);

        // Remove script and style tags
        $('script, style, nav, header, footer').remove();

        // Extract main content (try common content selectors)
        const mainContent = $('.content, .main, article, .article-content, #content').text() || $('body').text();

        // Clean up whitespace
        return mainContent.replace(/\s+/g, ' ').trim();
    }

    /**
     * Use AI to parse policy content and extract structured data
     */
    async parsePolicyWithAI(content: string, region: string, sourceUrl: string): Promise<PolicyData[]> {
        const prompt = `
你是一个专业的政策分析助手。请从以下政策文本中提取新能源相关的电价和补贴信息。

地区：${region}
来源：${sourceUrl}

政策文本：
${content.substring(0, 4000)} 

请提取以下信息并以JSON格式返回（数组形式，因为可能有多条政策）：
[
  {
    "type": "SUBSIDY_KWH | SUBSIDY_ONE_TIME | ELECTRICITY_PRICE",
    "value": 数值（浮点数）,
    "unit": "元/kWh | 元/W | 元/kW | 元",
    "conditions": "适用条件说明",
    "startDate": "YYYY-MM-DD（如果有）",
    "endDate": "YYYY-MM-DD（如果有）"
  }
]

说明：
- SUBSIDY_KWH: 按发电量补贴（如0.3元/kWh）
- SUBSIDY_ONE_TIME: 一次性补贴（如按装机容量补贴）
- ELECTRICITY_PRICE: 上网电价或销售电价

如果文本中没有相关政策信息，返回空数组 []。
只返回JSON，不要其他说明文字。
`;

        try {
            const response = await simpleChat(prompt, 'glm-4-plus');

            // Extract JSON from response (handle potential markdown code blocks)
            let jsonStr = response.trim();
            if (jsonStr.startsWith('```json')) {
                jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            } else if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/```\n?/g, '');
            }

            const parsed = JSON.parse(jsonStr);

            // Convert to PolicyData format
            const policies: PolicyData[] = Array.isArray(parsed) ? parsed : [parsed];

            return policies.map(p => ({
                region,
                type: p.type,
                value: typeof p.value === 'string' ? parseFloat(p.value) : p.value,
                unit: p.unit,
                conditions: p.conditions,
                sourceUrl,
                startDate: p.startDate ? new Date(p.startDate) : undefined,
                endDate: p.endDate ? new Date(p.endDate) : undefined,
            })).filter(p => p.value > 0); // Filter out invalid entries

        } catch (error) {
            console.error('AI parsing failed:', error);
            return [];
        }
    }

    /**
     * Main method: Crawl and parse policies for a region
     */
    async crawlRegionPolicies(region: string): Promise<PolicyData[]> {
        console.log(`🔍 Crawling policies for ${region}...`);

        const allPolicies: PolicyData[] = [];

        // Search for policy documents
        const urls = await this.searchPolicyDocuments(region, 'subsidy');

        // For demo purposes, we'll use mock data since we can't actually crawl government sites
        // In production, you would fetch and parse real URLs
        const mockPolicies = this.getMockPoliciesForRegion(region);
        allPolicies.push(...mockPolicies);

        console.log(`✅ Found ${allPolicies.length} policies for ${region}`);

        return allPolicies;
    }

    /**
     * Mock data for demonstration (replace with real crawling in production)
     */
    private getMockPoliciesForRegion(region: string): PolicyData[] {
        const mockData: Record<string, PolicyData[]> = {
            '上海': [
                {
                    region: '上海',
                    type: 'SUBSIDY_KWH',
                    value: 0.4,
                    unit: '元/kWh',
                    conditions: '分布式光伏自发自用部分',
                    sourceUrl: 'https://fgw.sh.gov.cn/mock',
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2026-12-31'),
                },
                {
                    region: '上海',
                    type: 'ELECTRICITY_PRICE',
                    value: 0.52,
                    unit: '元/kWh',
                    conditions: '工商业用电峰时电价',
                    sourceUrl: 'https://fgw.sh.gov.cn/mock',
                },
            ],
            '北京': [
                {
                    region: '北京',
                    type: 'SUBSIDY_KWH',
                    value: 0.3,
                    unit: '元/kWh',
                    conditions: '分布式光伏项目',
                    sourceUrl: 'https://fgw.beijing.gov.cn/mock',
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2025-12-31'),
                },
                {
                    region: '北京',
                    type: 'SUBSIDY_ONE_TIME',
                    value: 0.2,
                    unit: '元/W',
                    conditions: '户用光伏一次性补贴',
                    sourceUrl: 'https://fgw.beijing.gov.cn/mock',
                },
            ],
            '江苏': [
                {
                    region: '江苏',
                    type: 'SUBSIDY_KWH',
                    value: 0.32,
                    unit: '元/kWh',
                    conditions: '分布式光伏自发自用',
                    sourceUrl: 'https://fgw.jiangsu.gov.cn/mock',
                    startDate: new Date('2024-01-01'),
                },
                {
                    region: '江苏',
                    type: 'ELECTRICITY_PRICE',
                    value: 0.48,
                    unit: '元/kWh',
                    conditions: '工商业平段电价',
                    sourceUrl: 'https://fgw.jiangsu.gov.cn/mock',
                },
            ],
            '浙江': [
                {
                    region: '浙江',
                    type: 'SUBSIDY_KWH',
                    value: 0.35,
                    unit: '元/kWh',
                    conditions: '分布式光伏补贴',
                    sourceUrl: 'https://fzggw.zj.gov.cn/mock',
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2026-12-31'),
                },
            ],
            '广东': [
                {
                    region: '广东',
                    type: 'SUBSIDY_KWH',
                    value: 0.25,
                    unit: '元/kWh',
                    conditions: '分布式光伏项目',
                    sourceUrl: 'https://fzggw.gd.gov.cn/mock',
                },
                {
                    region: '广东',
                    type: 'ELECTRICITY_PRICE',
                    value: 0.55,
                    unit: '元/kWh',
                    conditions: '工商业峰时电价',
                    sourceUrl: 'https://fzggw.gd.gov.cn/mock',
                },
            ],
            '山东': [
                {
                    region: '山东',
                    type: 'SUBSIDY_KWH',
                    value: 0.28,
                    unit: '元/kWh',
                    conditions: '分布式光伏补贴',
                    sourceUrl: 'https://fgw.shandong.gov.cn/mock',
                },
            ],
            '河北': [
                {
                    region: '河北',
                    type: 'SUBSIDY_KWH',
                    value: 0.2,
                    unit: '元/kWh',
                    conditions: '分布式光伏项目',
                    sourceUrl: 'https://fgw.hebei.gov.cn/mock',
                },
            ],
        };

        return mockData[region] || [];
    }
}
