/**
 * Solar Calculator API v2
 * 
 * 集成终极护城河架构的示例API
 * 展示如何使用新的计算器并返回标准格式
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { SolarCalculatorV2 } from '@/lib/calculator/solar-v2';
import { ResultValidator, QualityTag } from '@/lib/kernel/calculation-result';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/v2/solar/calculate
 * 
 * 执行光伏收益计算（v2 - 带证据链）
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const userId = session?.user?.id;

        // 解析参数
        const body = await req.json();
        const {
            location,
            capacity,
            unitCost,
            electricityPrice,
            subsidyPrice,
            projectId,
            qualityTag = "STANDARD"
        } = body;

        // 参数验证
        if (!location || !capacity || !unitCost || !electricityPrice) {
            return NextResponse.json({
                success: false,
                error: "Missing required parameters"
            }, { status: 400 });
        }

        // 验证质量标签
        if (!["PREVIEW", "STANDARD", "AUDIT_GRADE"].includes(qualityTag)) {
            return NextResponse.json({
                success: false,
                error: "Invalid quality tag"
            }, { status: 400 });
        }

        // 根据质量要求检查权限
        if (qualityTag === "AUDIT_GRADE") {
            if (!userId) {
                return NextResponse.json({
                    success: false,
                    error: "AUDIT_GRADE requires authentication"
                }, { status: 401 });
            }

            try {
                // 检查用户是否有审计级权限（Pro或Enterprise用户）
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { plan: true }
                });

                if (!user || !['PRO', 'ENTERPRISE', 'FULL'].includes(user.plan)) {
                    return NextResponse.json({
                        success: false,
                        error: "AUDIT_GRADE requires Pro or Enterprise plan",
                        currentPlan: user?.plan || 'FREE'
                    }, { status: 403 });
                }
            } catch (dbError) {
                console.error("🏰 Auth DB Error:", dbError);
                // 数据库不可达时，暂时降级为 STANDARD 等级或报错
                return NextResponse.json({
                    success: false,
                    error: "Database connection failed during permission check. Please try again later.",
                    code: "DB_CONNECTION_ERROR"
                }, { status: 503 });
            }
        }

        // 执行计算（自动包含证据链）
        const result = await SolarCalculatorV2.calculate({
            location,
            capacity,
            unitCost,
            electricityPrice,
            subsidyPrice,
            qualityTag: qualityTag as QualityTag
        });

        // 验证结果完整性
        const validation = ResultValidator.validate(result);
        if (!validation.valid) {
            console.error("Result validation failed:", validation.errors);
            return NextResponse.json({
                success: false,
                error: "Calculation result validation failed",
                details: validation.errors
            }, { status: 500 });
        }

        // 记录警告（但不阻止返回）
        if (validation.warnings.length > 0) {
            console.warn("Result validation warnings:", validation.warnings);
        }

        // 持久化到数据库（🏰 护城河集成：生成受审计的快照）
        if (userId) {
            try {
                const snapshot = await prisma.calculationSnapshot.create({
                    data: {
                        userId,
                        projectId: projectId || null,
                        calcType: 'SOLAR_REVENUE',
                        calcVersion: result.auditMeta.version || '2.1.0',
                        assumptionVersion: result.auditMeta.assumptionVersion || '2024.1',
                        dataSourceVersion: result.evidence.dataProvenance.solarResource.source || 'NASA',
                        inputSnapshot: { location, capacity, unitCost, electricityPrice, subsidyPrice } as any,
                        outputSnapshot: result.result as any,
                        calculationTrace: result.evidence.calculationMeta as any,
                        dataEvidence: result.evidence.dataProvenance as any,
                        conclusion: {
                            headline: "光伏收益测算完成",
                            confidence: qualityTag === "AUDIT_GRADE" ? "HIGH" : "MEDIUM",
                            irr: result.result.irr,
                            payback: result.result.paybackPeriod
                        } as any,
                        risks: result.evidence.uncertaintyAnalysis || [] as any,
                        nextSteps: [
                            { priority: 1, action: "导出审计报告", reason: "计算已完成，可生成符合标准的审计文件" }
                        ] as any
                    }
                });

                // 记录到项目时间线 (Workflow OS)
                if (projectId) {
                    await prisma.projectEvent.create({
                        data: {
                            projectId,
                            userId,
                            eventType: 'FEASIBILITY_COMPLETED',
                            title: '完成光伏收益深度测算',
                            description: `生成了受审计的计算快照 (ID: ${snapshot.id})，IRR 为 ${result.result.irr.toFixed(2)}%`,
                            snapshotId: snapshot.id,
                            importance: 'HIGH'
                        }
                    });
                }

                // 将 snapshotId 返回给前端，用于后续审计跳转
                (result as any).snapshotId = snapshot.id;
            } catch (dbError) {
                console.error("🏰 Moat Persistence Error:", dbError);
            }
        }

        // 返回成功结果
        return NextResponse.json({
            success: true,
            data: result,
            meta: {
                validation: {
                    valid: validation.valid,
                    warnings: validation.warnings
                },
                persisted: !!userId,
                assumptionVersion: result.auditMeta.assumptionVersion,
                qualityTag: result.auditMeta.qualityTag
            }
        });

    } catch (error: any) {
        console.error("Solar calculation error:", error);

        return NextResponse.json({
            success: false,
            error: error.message || "Calculation failed"
        }, { status: 500 });
    }
}

/**
 * GET /api/v2/solar/calculate/[id]
 * 
 * 获取历史计算结果（带完整证据链）
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        const userId = session?.user?.id;

        if (!userId) {
            return NextResponse.json({
                success: false,
                error: "Authentication required"
            }, { status: 401 });
        }

        // 查询计算快照 (🏰 护城河集成：获取审计数据)
        const snapshot = await prisma.calculationSnapshot.findUnique({
            where: {
                id: params.id,
                userId
            },
            include: {
                project: true
            }
        });

        if (!snapshot) {
            return NextResponse.json({
                success: false,
                error: "Snapshot not found"
            }, { status: 404 });
        }

        // 重构为标准格式，兼容旧版前端组件
        const standardResult = {
            result: snapshot.outputSnapshot,
            auditMeta: {
                id: snapshot.id,
                version: snapshot.calcVersion,
                assumptionVersion: snapshot.assumptionVersion,
                timestamp: snapshot.createdAt,
                qualityTag: (snapshot.outputSnapshot as any)?.qualityTag || "STANDARD"
            },
            evidence: {
                dataProvenance: snapshot.dataEvidence,
                calculationMeta: snapshot.calculationTrace,
                uncertaintyAnalysis: snapshot.risks
            },
            conclusion: snapshot.conclusion,
            createdAt: snapshot.createdAt
        };

        return NextResponse.json({
            success: true,
            data: standardResult,
            meta: {
                qualityTag: standardResult.auditMeta.qualityTag,
                createdAt: snapshot.createdAt,
                projectId: snapshot.projectId
            }
        });

    } catch (error: any) {
        console.error("Get result error:", error);

        return NextResponse.json({
            success: false,
            error: error.message || "Failed to get result"
        }, { status: 500 });
    }
}
