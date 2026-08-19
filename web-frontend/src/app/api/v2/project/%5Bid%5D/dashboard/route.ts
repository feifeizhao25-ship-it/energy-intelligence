/**
 * 项目Dashboard API
 * GET /api/v2/project/[id]/dashboard
 * 
 * 用户每天回来看的数据！
 * 这是用户粘性的核心
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({
                success: false,
                error: "需要登录"
            }, { status: 401 });
        }

        const projectId = params.id;

        // TODO: 从数据库获取今日数据
        // const today = new Date();
        // today.setHours(0, 0, 0, 0);

        // const todayAnalysis = await prisma.dailyAnalysis.findUnique({
        //   where: {
        //     projectId_analysisDate: {
        //       projectId,
        //       analysisDate: today
        //     }
        //   }
        // });

        // const last7Days = await prisma.dailyAnalysis.findMany({
        //   where: {
        //     projectId,
        //     analysisDate: {
        //       gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        //     }
        //   },
        //   orderBy: { analysisDate: 'asc' }
        // });

        // const latestHealth = await prisma.assetHealthHistory.findFirst({
        //   where: { projectId },
        //   orderBy: { assessedAt: 'desc' }
        // });

        // const activeAlerts = await prisma.assetAlert.findMany({
        //   where: {
        //     projectId,
        //     status: 'ACTIVE'
        //   },
        //   orderBy: { createdAt: 'desc' },
        //   take: 5
        // });

        // 临时模拟数据（用于前端开发）
        const mockData = {
            today: {
                date: new Date().toISOString().split('T')[0],
                generation: {
                    actual: 1235,
                    expected: 1180,
                    ratio: 1.047,
                    change: "+5.2%"
                },
                pr: {
                    value: 0.823,
                    valuePercent: 82.3,
                    trend: "DOWN",
                    status: "WARNING", // GOOD, WARNING, CRITICAL
                    message: "低于标准"
                },
                revenue: {
                    actual: 556.50,
                    expected: 531.00,
                    deviation: 25.50,
                    change: "-¥32.50"
                },
                healthScore: {
                    value: 85,
                    grade: "AA",
                    trend: "STABLE"
                }
            },

            // 7天趋势
            trend: {
                labels: ["2月27日", "2月28日", "2月29日", "3月1日", "3月2日", "3月3日", "今日"],
                prData: [84.5, 83.2, 82.8, 81.5, 80.2, 81.8, 82.3],
                generationData: [1280, 1250, 1230, 1210, 1190, 1220, 1235],
                revenueData: [576, 562.5, 553.5, 544.5, 535.5, 549, 556.50]
            },

            // 异常告警
            alerts: [
                {
                    id: "alert-001",
                    type: "LOW_PR",
                    severity: "HIGH",
                    title: "PR连续3天低于80%",
                    description: "当前PR为82.3%，已连续3天低于标准值80%，可能存在组件污损或设备故障",
                    recommendation: "建议进行现场巡检，检查组件清洁度和逆变器状态",
                    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2小时前
                    status: "ACTIVE"
                }
            ],

            // 本周运维计划
            maintenancePlan: {
                weekOf: new Date().toISOString().split('T')[0],
                tasks: [
                    {
                        priority: "HIGH",
                        action: "组件清洗",
                        reason: "PR降至78%，预计损失¥500/天",
                        estimatedCost: 2000,
                        estimatedGain: 5000,
                        roi: "5天回本",
                        recommendedDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2天后
                        completed: false
                    }
                ]
            },

            // 项目概况
            summary: {
                activatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30天前
                totalDaysMonitored: 30,
                dataPointsCollected: 720, // 30天 × 24小时
                anomaliesDetected: 3,
                alertsSent: 5,
                reportsGenerated: 4
            }
        };

        return NextResponse.json({
            success: true,
            data: mockData
        });

    } catch (error: any) {
        console.error('[获取Dashboard数据失败]', error);

        return NextResponse.json({
            success: false,
            error: error.message || "获取Dashboard数据失败"
        }, { status: 500 });
    }
}

/**
 * 使用示例：
 * 
 * const response = await fetch('/api/v2/project/proj-123/dashboard');
 * const { data } = await response.json();
 * 
 * // 今日数据
 * console.log("今日发电：", data.today.generation.actual, "kWh");
 * console.log("今日PR：", data.today.pr.valuePercent, "%");
 * console.log("健康评分：", data.today.healthScore.value, data.today.healthScore.grade);
 * 
 * // 7天趋势
 * data.trend.prData.forEach((pr, i) => {
 *   console.log(data.trend.labels[i], "PR:", pr, "%");
 * });
 * 
 * // 告警
 * data.alerts.forEach(alert => {
 *   console.log(`[${alert.severity}] ${alert.title}`);
 *   console.log(`  ${alert.recommendation}`);
 * });
 */
