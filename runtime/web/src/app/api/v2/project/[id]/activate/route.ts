/**
 * 项目激活 API
 * POST /api/v2/project/[id]/activate
 * 
 * 这是0→1亿的关键功能！
 * 让项目从"算一次"变成"长期托管"
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { AssetLifecycleManager, DataSourceConnections, AutomationConfig, ProjectLifecycleStage } from '@/lib/asset/lifecycle-manager';

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({
                success: false,
                error: "需要登录"
            }, { status: 401 });
        }

        const userId = session.user.id;
        const userPlan = session.user.plan || 'FREE';
        const projectId = params.id;

        // 解析请求
        const body = await req.json();
        const {
            dataConnections,
            automation,
            initialStage = "OPERATING"
        } = body;

        // 权限检查
        if (userPlan === 'FREE') {
            return NextResponse.json({
                success: false,
                error: "项目激活功能需要Pro或更高计划",
                upgradeRequired: true,
                currentPlan: userPlan,
                requiredPlan: "PRO",
                message: "升级到Pro计划，享受项目长期托管、每日自动分析、健康度评分等功能"
            }, { status: 403 });
        }

        // 激活项目
        const activated = await AssetLifecycleManager.activateProject(
            projectId,
            {
                dataConnections: dataConnections as DataSourceConnections,
                automation: automation as AutomationConfig,
                initialStage: initialStage as ProjectLifecycleStage
            },
            userId
        );

        return NextResponse.json({
            success: true,
            data: activated,
            message: "项目激活成功！将开始每日自动分析"
        });

    } catch (error: any) {
        console.error('[项目激活失败]', error);

        return NextResponse.json({
            success: false,
            error: error.message || "项目激活失败"
        }, { status: 500 });
    }
}

/**
 * 获取项目激活状态
 * GET /api/v2/project/[id]/activate
 */
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

        // TODO: 从数据库获取激活状态
        // const activated = await prisma.activatedProject.findUnique({
        //   where: { projectId },
        //   include: {
        //     dailyAnalyses: {
        //       orderBy: { analysisDate: 'desc' },
        //       take: 7
        //     },
        //     healthHistory: {
        //       orderBy: { assessedAt: 'desc' },
        //       take: 1
        //     },
        //     alerts: {
        //       where: { status: 'ACTIVE' },
        //       orderBy: { createdAt: 'desc' }
        //     }
        //   }
        // });

        // 临时返回
        return NextResponse.json({
            success: true,
            data: {
                isActivated: false,
                message: "项目未激活"
            }
        });

    } catch (error: any) {
        console.error('[获取激活状态失败]', error);

        return NextResponse.json({
            success: false,
            error: error.message || "获取激活状态失败"
        }, { status: 500 });
    }
}

/**
 * 暂停激活
 * PUT /api/v2/project/[id]/activate/suspend
 */
export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
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

        // TODO: 更新状态为SUSPENDED
        // await prisma.activatedProject.update({
        //   where: { projectId },
        //   data: {
        //     activationStatus: 'SUSPENDED',
        //     suspendedAt: new Date()
        //   }
        // });

        return NextResponse.json({
            success: true,
            message: "项目已暂停监测"
        });

    } catch (error: any) {
        console.error('[暂停激活失败]', error);

        return NextResponse.json({
            success: false,
            error: error.message || "暂停激活失败"
        }, { status: 500 });
    }
}

/**
 * 使用示例：
 * 
 * // 激活项目
 * const response = await fetch('/api/v2/project/proj-123/activate', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     dataConnections: {
 *       inverter: {
 *         type: "HUAWEI",
 *         endpoint: "https://api.huawei.com/solar/data",
 *         credentials: {
 *           apiKey: "your-api-key"
 *         },
 *         pollInterval: 15
 *       },
 *       weather: {
 *         provider: "OPEN_METEO",
 *         location: { lat: 39.9, lng: 116.4 }
 *       }
 *     },
 *     automation: {
 *       dailyPRCalculation: true,
 *       monthlyRevenueReport: true,
 *       anomalyDetection: {
 *         enabled: true,
 *         thresholds: {
 *           prDropThreshold: 0.8,
 *           generationDropThreshold: 0.7,
 *           faultCountThreshold: 3
 *         }
 *       },
 *       performanceAlert: {
 *         enabled: true,
 *         recipients: ["manager@example.com"],
 *         alertChannels: ["EMAIL", "SMS"]
 *       },
 *       maintenanceAdvisor: {
 *         enabled: true,
 *         frequency: "WEEKLY"
 *       }
 *     },
 *     initialStage: "OPERATING"
 *   })
 * });
 * 
 * const data = await response.json();
 * if (data.success) {
 *   console.log("项目激活成功！", data.data);
 * }
 */
