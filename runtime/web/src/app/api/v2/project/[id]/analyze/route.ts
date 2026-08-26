/**
 * 项目分析 API - 终极护城河架构集成示例
 * 
 * 展示Phase 1-3完整集成：
 * Phase 1: 可信计算（Calculator V2）
 * Phase 2: 智能编排（Signals + Actions）
 * Phase 3: 交付沉淀（Report + Timeline）
 * 
 * POST /api/v2/project/[id]/analyze
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';

// Phase 1: 核心内核
import { SolarCalculatorV2 } from '@/lib/calculator/solar-v2';
import { QualityTag } from '@/lib/kernel/calculation-result';

// Phase 2: 编排增强
import { EnhancedSignalGenerator } from '@/lib/orchestrator/enhanced-signals';
import { ActionGenerator } from '@/lib/orchestrator/deliverable-actions';
import { StageManager, ProjectStage } from '@/lib/orchestrator/stage-deliverables';

// Phase 3: 交付沉淀
import { ReportGenerator } from '@/lib/reports/generator';
import { TimelineManager } from '@/lib/timeline/manager';

/**
 * POST /api/v2/project/[id]/analyze
 * 
 * 完整的项目分析流程，展示终极护城河架构
 */
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const requestStartedAt = Date.now();
    try {
        const session = await getServerSession(authOptions);
        const userId = session?.user?.id;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userPlan = session?.user?.plan || 'FREE';
        const projectId = params.id;

        // 解析请求参数
        const body = await req.json();
        const {
            location,
            capacity,
            unitCost,
            electricityPrice,
            subsidyPrice,
            qualityTag = "STANDARD",
            generateReport = false,
            projectName = "未命名项目"
        } = body;

        console.log('[Analysis] Starting authenticated project analysis');

        // ═══════════════════════════════════════
        // Phase 1: 核心计算（可信、可复现）
        // ═══════════════════════════════════════
        console.log('[Phase 1] 执行核心计算...');

        const calculationResult = await SolarCalculatorV2.calculate({
            location,
            capacity,
            unitCost,
            electricityPrice,
            subsidyPrice,
            qualityTag: qualityTag as QualityTag
        });

        console.log(`[Phase 1] ✅ 计算完成: IRR=${calculationResult.result.irr.toFixed(2)}%`);
        console.log(`[Phase 1] 证据链ID=${calculationResult.evidence.conclusionId}`);
        console.log(`[Phase 1] 防篡改哈希=${calculationResult.auditMeta.hash.substring(0, 16)}...`);

        // ═══════════════════════════════════════
        // Phase 3: 记录时间线（资产沉淀）
        // ═══════════════════════════════════════
        console.log('[Phase 3] 记录项目时间线...');

        const milestone = await TimelineManager.recordCalculation(
            projectId,
            calculationResult,
            undefined, // TODO: 获取上一次计算结果进行对比
            userId
        );

        console.log(`[Phase 3] ✅ 时间线记录完成: ${milestone.title}`);

        // ═══════════════════════════════════════
        // Phase 2: 智能编排（评估+推荐）
        // ═══════════════════════════════════════
        console.log('[Phase 2] 生成增强信号...');

        const signals = await EnhancedSignalGenerator.generate(
            projectId,
            userId || '',
            userPlan
        );

        console.log(`[Phase 2] 证据完整性评分: ${signals.evidenceCompleteness.score.toFixed(2)}`);
        console.log(`[Phase 2] 可交付性评分: ${signals.deliverabilityScore.score.toFixed(2)}`);
        console.log(`[Phase 2] 整体风险: ${signals.riskSignals.overallRisk}`);
        console.log(`[Phase 2] 推荐质量等级: ${signals.recommendedQualityTag}`);

        const actions = ActionGenerator.generateActions(signals);

        console.log(`[Phase 2] ✅ 生成了${actions.length}个推荐动作`);
        actions.slice(0, 3).forEach(action => {
            console.log(`  - [优先级${action.priority}] ${action.title}`);
        });

        // ═══════════════════════════════════════
        // Phase 3: 生成报告（如果请求）
        // ═══════════════════════════════════════
        let report = null;

        if (generateReport) {
            console.log('[Phase 3] 生成标准报告...');

            // 检查权限（审计级需要Pro）
            if (qualityTag === "AUDIT_GRADE" && !['PRO', 'ENTERPRISE', 'FULL'].includes(userPlan)) {
                return NextResponse.json({
                    success: false,
                    error: "AUDIT_GRADE报告需要Pro或Enterprise计划",
                    upgradeRequired: true,
                    currentPlan: userPlan
                }, { status: 403 });
            }

            report = await ReportGenerator.generateInvestmentReport(
                calculationResult,
                {
                    id: projectId,
                    name: projectName,
                    location: location.address || `${location.lat}, ${location.lng}`,
                    capacity: capacity,
                    type: "SOLAR"
                },
                undefined, // clientInfo
                userId
            );

            console.log(`[Phase 3] 报告内容组装完成（未生成下载文件）: ${report.id}`);

            // 记录报告生成里程碑
            await TimelineManager.recordReportGeneration(
                projectId,
                report.id,
                "INVESTMENT_ANALYSIS",
                qualityTag,
                userId
            );
        }

        // ═══════════════════════════════════════
        // 获取当前阶段信息
        // ═══════════════════════════════════════
        const stageMap: Record<typeof signals.stage, ProjectStage> = {
            PLANNING: 'SITE_SELECTION',
            DESIGN: 'DESIGN',
            CONSTRUCTION: 'CONSTRUCTION',
            OPERATIONS: 'OPERATIONS',
            OPTIMIZATION: 'OPTIMIZATION',
        };
        const currentStage = stageMap[signals.stage];
        const stageDefinition = StageManager.getStageDefinition(currentStage);
        const nextStages = StageManager.getNextStages(currentStage);

        // ═══════════════════════════════════════
        // 返回完整响应
        // ═══════════════════════════════════════

        const response = {
            success: true,

            // Phase 1: 计算结果
            calculation: {
                id: calculationResult.auditMeta.id,
                result: calculationResult.result,
                auditMeta: {
                    assumptionVersion: calculationResult.auditMeta.assumptionVersion,
                    qualityTag: calculationResult.auditMeta.qualityTag,
                    hash: calculationResult.auditMeta.hash,
                    createdAt: calculationResult.createdAt
                },
                evidence: {
                    id: calculationResult.evidence.conclusionId,
                    dataSourcesCount: Object.keys(calculationResult.evidence.dataProvenance).length,
                    hasUncertaintyAnalysis: !!calculationResult.evidence.uncertaintyAnalysis,
                    regulatoryCompliance: calculationResult.evidence.regulatoryCompliance
                }
            },

            // Phase 2: 智能编排
            orchestration: {
                signals: {
                    evidenceCompleteness: signals.evidenceCompleteness,
                    deliverabilityScore: signals.deliverabilityScore,
                    riskSignals: signals.riskSignals,
                    currentQualityTag: signals.currentQualityTag,
                    recommendedQualityTag: signals.recommendedQualityTag,
                    needsQualityUpgrade: signals.needsQualityUpgrade
                },
                actions: actions.map(action => ({
                    id: action.id,
                    type: action.type,
                    priority: action.priority,
                    title: action.title,
                    description: action.description,
                    valueProposition: action.valueProposition,
                    deliverable: {
                        title: action.deliverable.title,
                        estimatedTime: action.deliverable.estimatedTime,
                        formats: action.deliverable.formats,
                        externalSubmission: action.deliverable.externalSubmission
                    },
                    riskLevel: action.riskLevel,
                    pricing: action.pricing,
                    cta: action.cta
                })),
                stage: {
                    current: currentStage,
                    name: stageDefinition.name,
                    objectives: stageDefinition.objectives,
                    primaryDeliverable: stageDefinition.primaryDeliverable.name,
                    nextStages: nextStages
                }
            },

            // Phase 3: 交付沉淀
            assets: {
                timeline: {
                    latestMilestone: {
                        type: milestone.milestoneType,
                        title: milestone.title,
                        summary: milestone.summary,
                        createdAt: milestone.createdAt
                    }
                },
                report: report ? {
                    id: report.id,
                    type: report.reportType,
                    qualityTag: report.metadata.qualityTag,
                    sections: {
                        hasExecutiveSummary: !!report.executiveSummary,
                        hasDetailedAnalysis: !!report.detailedAnalysis,
                        hasEvidenceAppendix: !!report.evidenceAppendix,
                        hasUncertaintyAnalysis: !!report.uncertaintyAnalysis,
                        hasCompliance: !!report.compliance
                    },
                    downloads: {
                        pdf: report.pdfUrl,
                        excel: report.excelUrl,
                        json: report.jsonUrl
                    }
                } : null
            },

            // 元数据
            meta: {
                processingTime: Date.now() - requestStartedAt,
                phases: {
                    phase1: "✅ 核心计算完成",
                    phase2: "✅ 智能编排完成",
                    phase3: generateReport ? "✅ 报告内容已组装（文件导出未启用）" : "⏭ 未生成报告"
                },
                architecture: "终极护城河 v1.1",
                moatStrength: "🏰🏰🏰🏰🏰"
            }
        };

        console.log('[🎉 分析完成] 所有Phase运行成功');

        return NextResponse.json(response);

    } catch (error: any) {
        console.error('[❌ 分析失败]', error);

        return NextResponse.json({
            success: false,
            error: error.message || "项目分析失败",
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}

/**
 * GET /api/v2/project/[id]/analyze
 * 
 * 获取项目分析历史和当前状态
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        const userId = session?.user?.id;
        const projectId = params.id;

        if (!userId) {
            return NextResponse.json({
                success: false,
                error: "需要登录"
            }, { status: 401 });
        }

        // 获取项目时间线
        const timeline = await TimelineManager.getTimeline(projectId, {
            limit: 20
        });

        // 获取时间线统计
        const stats = await TimelineManager.getTimelineStats(projectId);

        // 生成信号
        const signals = await EnhancedSignalGenerator.generate(
            projectId,
            userId,
            session.user?.plan || 'FREE'
        );

        return NextResponse.json({
            success: true,
            timeline: {
                milestones: timeline,
                stats: stats
            },
            currentState: {
                stage: signals.stage,
                evidenceCompleteness: signals.evidenceCompleteness,
                deliverabilityScore: signals.deliverabilityScore,
                riskSignals: signals.riskSignals
            }
        });

    } catch (error: any) {
        console.error('[获取项目状态失败]', error);

        return NextResponse.json({
            success: false,
            error: error.message || "获取项目状态失败"
        }, { status: 500 });
    }
}

/**
 * 使用示例：
 * 
 * // 执行完整分析
 * const response = await fetch('/api/v2/project/proj-123/analyze', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     location: { lat: 39.9, lng: 116.4, address: "北京" },
 *     capacity: 10000,
 *     unitCost: 3.5,
 *     electricityPrice: 0.45,
 *     subsidyPrice: 0.12,
 *     qualityTag: "AUDIT_GRADE",
 *     generateReport: true,
 *     projectName: "某某光伏电站"
 *   })
 * });
 * 
 * const data = await response.json();
 * 
 * // 查看计算结果
 * console.log("IRR:", data.calculation.result.irr);
 * 
 * // 查看推荐动作
 * data.orchestration.actions.forEach(action => {
 *   console.log(`[${action.priority}] ${action.title}`);
 *   console.log(`  交付物: ${action.deliverable.title}`);
 *   console.log(`  预计: ${action.deliverable.estimatedTime}分钟`);
 * });
 * 
 * // 下载报告
 * if (data.assets.report) {
 *   window.open(data.assets.report.downloads.pdf);
 * }
 */
