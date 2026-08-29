/**
 * 项目Dashboard API
 * GET /api/v2/project/[id]/dashboard
 *
 * 用户每天回来看的数据！
 * 这是用户粘性的核心
 *
 * 修复说明：
 * 此前该端点把 Prisma 查询整段注释掉，直接返回一组写死的数字
 * （发电 1235kWh / 收益 ¥556.50 / 健康分 85 / 一条编造的告警）。
 * 电站主每天看到的是同一份假数据，且无法察觉。
 * 现改为真实查询；无数据时返回 204 语义的空态，由前端展示"暂无监测数据"，
 * 绝不再用编造的数字填充。
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';

function formatLabel(d: Date): string {
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({
                success: false,
                error: "需要登录"
            }, { status: 401 });
        }

        const projectId = params.id;

        // 越权校验：只能看自己的项目
        const project = await prisma.project.findFirst({
            where: { id: projectId, userId: session.user.id },
        });
        if (!project) {
            return NextResponse.json({
                success: false,
                error: "项目不存在或无权访问"
            }, { status: 404 });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const [todayAnalysis, last7Days, activeAlerts, maintenancePlans] = await Promise.all([
            prisma.dailyAnalysis.findUnique({
                where: { projectId_analysisDate: { projectId, analysisDate: today } },
            }),
            prisma.dailyAnalysis.findMany({
                where: { projectId, analysisDate: { gte: weekAgo } },
                orderBy: { analysisDate: 'asc' },
            }),
            prisma.assetAlert.findMany({
                where: { projectId, status: 'ACTIVE' },
                orderBy: { createdAt: 'desc' },
                take: 5,
            }),
            prisma.maintenancePlan.findMany({
                where: { projectId },
                orderBy: { createdAt: 'desc' },
                take: 1,
            }),
        ]);

        // 尚未接入采集数据时给出明确空态，而不是编造数字
        if (!todayAnalysis && last7Days.length === 0) {
            return NextResponse.json({
                success: true,
                data: null,
                empty: true,
                message: "该项目暂无监测数据，请先完成数据采集接入。",
            });
        }

        const prev = last7Days.length > 1 ? last7Days[last7Days.length - 2] : null;
        // Prisma Decimal 需要显式转数字后再参与运算/序列化
        const num = (v: any): number | null => (v == null ? null : Number(v));
        const pct = (cur: number | null, before: number | null) =>
            cur != null && before != null && before !== 0
                ? `${(((cur - before) / before) * 100).toFixed(1)}%`
                : null;

        const todayPr = num(todayAnalysis?.pr);

        const data = {
            today: todayAnalysis ? {
                date: today.toISOString().split('T')[0],
                generation: {
                    actual: num(todayAnalysis.generationActual),
                    expected: num(todayAnalysis.generationExpected),
                    ratio: num(todayAnalysis.generationRatio),
                    change: pct(
                        num(todayAnalysis.generationActual),
                        num(prev?.generationActual),
                    ),
                },
                pr: {
                    value: todayPr,
                    valuePercent: todayPr != null ? Number((todayPr * 100).toFixed(1)) : null,
                    trend: todayAnalysis.prTrend,
                    status: todayPr == null
                        ? 'UNKNOWN'
                        : todayPr >= 0.8
                            ? 'GOOD'
                            : todayPr >= 0.7 ? 'WARNING' : 'CRITICAL',
                },
                revenue: {
                    actual: num(todayAnalysis.revenueActual),
                    expected: num(todayAnalysis.revenueExpected),
                    deviation: num(todayAnalysis.revenueDeviation),
                },
                healthScore: {
                    value: num(todayAnalysis.healthScore),
                    trend: todayAnalysis.trend,
                },
                faultCount: todayAnalysis.faultCount,
                anomalies: todayAnalysis.anomalies,
            } : null,

            trend: {
                labels: last7Days.map(d => formatLabel(new Date(d.analysisDate))),
                prData: last7Days.map(d => {
                    const v = num(d.pr);
                    return v != null ? Number((v * 100).toFixed(1)) : null;
                }),
                generationData: last7Days.map(d => num(d.generationActual)),
                revenueData: last7Days.map(d => num(d.revenueActual)),
            },

            alerts: activeAlerts.map(a => ({
                id: a.id,
                type: a.alertType,
                severity: a.severity,
                title: a.title,
                description: a.description,
                recommendation: a.recommendation,
                createdAt: a.createdAt.toISOString(),
                status: a.status,
            })),

            // MaintenancePlan.tasks 是 JSONB，直接透传由前端渲染
            maintenancePlan: maintenancePlans[0]
                ? {
                    weekOf: maintenancePlans[0].weekOf.toISOString().split('T')[0],
                    tasks: maintenancePlans[0].tasks,
                    completed: maintenancePlans[0].completed,
                }
                : { weekOf: today.toISOString().split('T')[0], tasks: [], completed: false },

            summary: {
                activatedAt: project.createdAt?.toISOString() ?? null,
                totalDaysMonitored: last7Days.length,
                anomaliesDetected: activeAlerts.length,
            },
        };

        return NextResponse.json({ success: true, data });

    } catch (error: any) {
        console.error('[获取Dashboard数据失败]', error);

        return NextResponse.json({
            success: false,
            error: error.message || "获取Dashboard数据失败"
        }, { status: 500 });
    }
}
