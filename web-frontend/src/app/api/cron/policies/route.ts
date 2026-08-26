import { NextRequest, NextResponse } from 'next/server';
import { PolicyCrawler } from '@/lib/crawler/policy-crawler';
import { PolicyService } from '@/lib/services/policy-service';

// 主要省份列表
const MAJOR_PROVINCES = [
    '北京', '上海', '江苏', '浙江', '广东', '山东', '河北', '河南',
    '四川', '湖北', '湖南', '安徽', '福建', '陕西', '内蒙古', '新疆'
];

export async function POST(request: NextRequest) {
    try {
        // 验证请求（可选：添加 API Key 验证）
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET || 'dev-secret-key';

        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const { regions } = body as { regions?: string[] };

        const targetRegions = regions || MAJOR_PROVINCES;

        console.log(`🚀 Starting policy update for ${targetRegions.length} regions...`);

        const crawler = new PolicyCrawler();
        const results = {
            success: [] as string[],
            failed: [] as string[],
            totalPolicies: 0,
        };

        // 爬取每个地区的政策
        for (const region of targetRegions) {
            try {
                const policies = await crawler.crawlRegionPolicies(region);

                // 保存到数据库
                for (const policy of policies) {
                    await PolicyService.upsertPolicy(policy);
                }

                results.success.push(region);
                results.totalPolicies += policies.length;

                console.log(`✅ ${region}: ${policies.length} policies updated`);

                // 避免请求过快，添加延迟
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error(`❌ Failed to update ${region}:`, error);
                results.failed.push(region);
            }
        }

        console.log(`✅ Policy update complete: ${results.totalPolicies} policies from ${results.success.length} regions`);

        return NextResponse.json({
            success: true,
            message: `Updated ${results.totalPolicies} policies`,
            results,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('Policy update error:', error);
        return NextResponse.json(
            {
                error: 'Failed to update policies',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

// GET endpoint for manual trigger (development only)
export async function GET(request: NextRequest) {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
            { error: 'Use POST method with authentication' },
            { status: 405 }
        );
    }

    // Trigger update for a single region for testing
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region') || '上海';

    try {
        const crawler = new PolicyCrawler();
        const policies = await crawler.crawlRegionPolicies(region);

        // Save to database
        for (const policy of policies) {
            await PolicyService.upsertPolicy(policy);
        }

        return NextResponse.json({
            success: true,
            region,
            policies,
            count: policies.length,
        });

    } catch (error) {
        return NextResponse.json(
            {
                error: 'Failed to crawl policies',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
