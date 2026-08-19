import { NextRequest, NextResponse } from 'next/server';

/**
 * 性能分析 API
 * 基于历史数据提供深度性能分析和优化建议
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const projectId = params.id;
    const url = new URL(req.url);
    const period = url.searchParams.get('period') || '30d'; // 7d, 30d, 90d, 1y

    // 模拟性能分析数据
    const analysis = {
        projectId,
        period,
        analyzedAt: new Date().toISOString(),

        // 发电效率分析
        efficiency: {
            current: 92.5,
            target: 95.0,
            gap: 2.5,
            trend: 'improving', // improving, declining, stable
            historicalData: Array.from({ length: 30 }, (_, i) => ({
                date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                value: 90 + Math.random() * 5
            }))
        },

        // 可用性分析
        availability: {
            current: 98.2,
            industry: 97.5,
            rating: 'excellent', // excellent, good, average, poor
            downtime: {
                total: 13.2, // hours
                planned: 8.0,
                unplanned: 5.2
            }
        },

        // 损失分析
        losses: [
            { type: '逆变器损失', percentage: 2.3, impact: 'medium' },
            { type: '线路损失', percentage: 1.8, impact: 'low' },
            { type: '积灰遮挡', percentage: 3.5, impact: 'high' },
            { type: '温度影响', percentage: 1.2, impact: 'low' },
            { type: '其他', percentage: 0.7, impact: 'low' }
        ],

        // 对标分析
        benchmarking: {
            peers: [
                { metric: '发电效率', project: 92.5, industry: 91.2, rank: 'top 25%' },
                { metric: 'PR值', project: 85.3, industry: 83.8, rank: 'top 30%' },
                { metric: '可用性', project: 98.2, industry: 97.5, rank: 'top 20%' },
                { metric: '运维成本', project: 0.15, industry: 0.18, rank: 'top 15%', unit: '元/kWh' }
            ]
        },

        // 优化建议
        recommendations: [
            {
                priority: 'high',
                category: '清洁维护',
                title: '增加组件清洗频率',
                description: '当前积灰遮挡造成 3.5% 的发电损失，建议从季度清洗改为月度清洗',
                expectedGain: '2-3% 发电量提升',
                estimatedCost: '5000 元/次',
                roi: '6-8个月回本'
            },
            {
                priority: 'medium',
                category: '设备升级',
                title: '优化逆变器配置',
                description: '部分逆变器运行效率偏低，建议评估升级或调整运行参数',
                expectedGain: '1-1.5% 效率提升',
                estimatedCost: '评估中',
                roi: '2-3年'
            },
            {
                priority: 'medium',
                category: '运维优化',
                title: '实施预测性维护',
                description: '基于AI算法预测设备故障，减少非计划停机',
                expectedGain: '减少 30% 非计划停机',
                estimatedCost: '咨询服务',
                roi: '1年'
            },
            {
                priority: 'low',
                category: '监控升级',
                title: '增加微气象监测站',
                description: '提高发电预测准确性，优化运维计划',
                expectedGain: '提升预测精度至 95%+',
                estimatedCost: '15000 元',
                roi: '长期效益'
            }
        ],

        // 财务影响
        financialImpact: {
            potentialRevenueLoss: {
                current: 28500, // 元/年
                optimized: 12000,
                savings: 16500
            },
            optimizationCost: 35000, // 一次性投入
            paybackPeriod: 2.1 // 年
        }
    };

    return NextResponse.json({
        success: true,
        data: analysis
    });
}
