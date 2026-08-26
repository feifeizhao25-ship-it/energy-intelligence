import { NextRequest, NextResponse } from 'next/server';

/**
 * 生成运维报告
 * 整合设备、告警、维护、监控数据生成综合报告
 */
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const projectId = params.id;
    const body = await req.json();
    const { reportType = 'daily', format = 'json' } = body;

    try {
        // 模拟数据聚合
        const report = {
            id: `report-${Date.now()}`,
            projectId,
            reportType,
            generatedAt: new Date().toISOString(),
            period: {
                start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                end: new Date().toISOString()
            },
            summary: {
                // 发电数据
                generation: {
                    total: (Math.random() * 1000 + 500).toFixed(2), // kWh
                    peak: (Math.random() * 100 + 50).toFixed(2),
                    average: (Math.random() * 60 + 30).toFixed(2),
                    efficiency: (Math.random() * 10 + 90).toFixed(2) + '%'
                },
                // 设备状态
                equipment: {
                    total: 5,
                    online: 4,
                    offline: 0,
                    warning: 1,
                    maintenance: 0
                },
                // 告警统计
                alerts: {
                    total: 3,
                    critical: 0,
                    warning: 2,
                    info: 1,
                    resolved: 2,
                    pending: 1
                },
                // 维护记录
                maintenance: {
                    completed: 2,
                    scheduled: 3,
                    overdue: 0
                },
                // 性能指标
                performance: {
                    uptime: '99.8%',
                    pr: '85.3%', // Performance Ratio
                    availability: '98.5%',
                    meanTimeBetweenFailures: '720 hours'
                }
            },
            details: {
                hourlyGeneration: Array.from({ length: 24 }, (_, i) => ({
                    hour: i,
                    power: (Math.random() * 80 + 20).toFixed(1)
                })),
                topIssues: [
                    { issue: '逆变器 #3 温度偏高', severity: 'warning', count: 1 },
                    { issue: '光伏组件需清洗', severity: 'info', count: 1 }
                ],
                recommendations: [
                    '建议在下周进行光伏组件清洗，预计可提升发电效率 3-5%',
                    '关注 3 号逆变器散热情况，必要时安排检修',
                    '当前系统运行状态良好，继续保持定期巡检'
                ]
            }
        };

        // 如果需要 PDF 格式，返回下载链接（实际应生成 PDF）
        if (format === 'pdf') {
            return NextResponse.json({
                success: true,
                data: {
                    reportId: report.id,
                    downloadUrl: `/api/projects/${projectId}/reports/${report.id}/download`,
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                }
            });
        }

        // 默认返回 JSON
        return NextResponse.json({
            success: true,
            data: report
        });

    } catch (error: any) {
        console.error('Report generation failed:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to generate report'
        }, { status: 500 });
    }
}

// GET - 获取历史报告列表
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const reports = [
        {
            id: 'report-1',
            type: 'daily',
            generatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            title: '每日运维报告 - ' + new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString(),
            size: '2.5 MB'
        },
        {
            id: 'report-2',
            type: 'weekly',
            generatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            title: '周运维报告 - ' + new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
            size: '8.2 MB'
        }
    ];

    return NextResponse.json({
        success: true,
        data: reports
    });
}
