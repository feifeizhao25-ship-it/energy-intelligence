import { NextRequest, NextResponse } from 'next/server';
import { withOpenApi } from '@/lib/api/open-api-middleware';

/**
 * 开放 API v1 - 性能分析
 * 
 * GET /api/v1/projects/[id]/analytics
 * 
 * Headers:
 *   X-API-Key: your_api_key
 *   
 * Query Parameters:
 *   - period: 分析周期 (7d, 30d, 90d, 1y)
 *   - metrics: 指标选择 (efficiency, availability, generation, all)
 */

async function handleGetAnalytics(req: NextRequest, keyData: any) {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const projectId = pathParts[pathParts.length - 2];
    const period = url.searchParams.get('period') || '30d';
    const metrics = url.searchParams.get('metrics') || 'all';

    // 生成分析数据
    const analytics = {
        projectId,
        period,
        analyzedAt: new Date().toISOString(),

        // 效率分析
        efficiency: {
            current: 92.5,
            target: 95.0,
            trend: 'improving',
            percentile: 75, // 行业百分位
            history: Array.from({ length: 30 }, (_, i) => ({
                date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                value: 90 + Math.random() * 5
            }))
        },

        // 可用性分析
        availability: {
            current: 98.2,
            target: 99.0,
            trend: 'stable',
            downtime: {
                totalHours: 13.2,
                plannedHours: 8.0,
                unplannedHours: 5.2,
                mtbf: 720 // Mean Time Between Failures (hours)
            }
        },

        // 发电量分析
        generation: {
            daily: {
                actual: 450,
                expected: 480,
                variance: -6.3
            },
            monthly: {
                actual: 12500,
                expected: 13500,
                variance: -7.4
            },
            cumulative: {
                total: 125000,
                co2Saved: 102.5 // tons
            }
        },

        // 性能比
        performanceRatio: {
            current: 85.3,
            target: 90.0,
            industryAvg: 83.8,
            history: Array.from({ length: 30 }, (_, i) => ({
                date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                value: 82 + Math.random() * 8
            }))
        },

        // 损失分解
        losses: {
            total: 9.5,
            breakdown: [
                { category: 'inverter', percentage: 2.3, description: '逆变器损失' },
                { category: 'cable', percentage: 1.8, description: '线路损失' },
                { category: 'soiling', percentage: 3.5, description: '积灰遮挡' },
                { category: 'temperature', percentage: 1.2, description: '温度影响' },
                { category: 'other', percentage: 0.7, description: '其他损失' }
            ]
        },

        // 对标分析
        benchmarking: {
            rank: 'top_25_percent',
            metrics: [
                { name: '发电效率', value: 92.5, benchmark: 91.2, status: 'above' },
                { name: 'PR值', value: 85.3, benchmark: 83.8, status: 'above' },
                { name: '可用性', value: 98.2, benchmark: 97.5, status: 'above' },
                { name: '运维成本', value: 0.15, benchmark: 0.18, status: 'below', unit: '元/kWh' }
            ]
        },

        // AI 洞察
        insights: [
            {
                type: 'optimization',
                priority: 'high',
                title: '组件清洗建议',
                description: '积灰遮挡导致 3.5% 损失，建议增加清洗频率',
                potentialGain: '2-3% 发电量'
            },
            {
                type: 'maintenance',
                priority: 'medium',
                title: '逆变器效率优化',
                description: '部分逆变器效率偏低，建议检查散热系统',
                potentialGain: '1-1.5% 效率提升'
            }
        ]
    };

    return NextResponse.json({
        success: true,
        data: analytics,
        meta: {
            timestamp: new Date().toISOString(),
            version: 'v1'
        }
    });
}

export const GET = withOpenApi(handleGetAnalytics, 'read:analytics');
