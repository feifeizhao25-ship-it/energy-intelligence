import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/papers/link-to-project
 * 将文献关联到项目并生成AI应用建议
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { paperId, savedPaperId, projectId } = body;

        if (!projectId) {
            return NextResponse.json(
                { success: false, error: 'Project ID is required' },
                { status: 400 }
            );
        }

        // 验证项目归属
        const project = await prisma.project.findFirst({
            where: {
                id: projectId,
                userId: session.user.id,
            },
            select: {
                id: true,
                name: true,
                type: true,
                capacity: true,
            },
        });

        if (!project) {
            return NextResponse.json(
                { success: false, error: 'Project not found' },
                { status: 404 }
            );
        }

        let paper;

        // 如果提供了savedPaperId,更新现有记录
        if (savedPaperId) {
            paper = await prisma.savedPaper.findFirst({
                where: {
                    id: savedPaperId,
                    userId: session.user.id,
                },
            });

            if (!paper) {
                return NextResponse.json(
                    { success: false, error: 'Saved paper not found' },
                    { status: 404 }
                );
            }

            // 生成AI应用建议
            const { aiInsights, relevanceScore } = await generateAIInsights(
                paper,
                project
            );

            // 更新savedPaper关联项目
            const updatedPaper = await prisma.savedPaper.update({
                where: { id: savedPaperId },
                data: {
                    projectId,
                    aiInsights,
                    relevanceScore,
                },
            });

            return NextResponse.json({
                success: true,
                data: {
                    savedPaper: updatedPaper,
                    aiInsights,
                },
            });
        }

        // 如果是新文献,创建savedPaper记录
        if (paperId) {
            // 检查是否已保存过
            const existing = await prisma.savedPaper.findUnique({
                where: {
                    userId_paperId: {
                        userId: session.user.id,
                        paperId,
                    },
                },
            });

            if (existing) {
                // 如果已存在,更新项目关联
                const { aiInsights, relevanceScore } = await generateAIInsights(
                    existing,
                    project
                );

                const updated = await prisma.savedPaper.update({
                    where: { id: existing.id },
                    data: {
                        projectId,
                        aiInsights,
                        relevanceScore,
                    },
                });

                return NextResponse.json({
                    success: true,
                    data: {
                        savedPaper: updated,
                        aiInsights,
                        message: 'Paper already saved, updated project link',
                    },
                });
            }

            // 获取论文详情（从推荐表或API）
            const paperDetails = await fetchPaperDetails(paperId, projectId);

            if (!paperDetails) {
                return NextResponse.json(
                    { success: false, error: 'Paper details not found' },
                    { status: 404 }
                );
            }

            // 生成AI应用建议
            const { aiInsights, relevanceScore } = await generateAIInsights(
                paperDetails,
                project
            );

            // 创建新的savedPaper记录
            const newPaper = await prisma.savedPaper.create({
                data: {
                    userId: session.user.id,
                    paperId,
                    projectId,
                    title: paperDetails.title,
                    authors: paperDetails.authors,
                    year: paperDetails.year,
                    abstract: paperDetails.abstract,
                    pdfUrl: paperDetails.pdfUrl,
                    aiInsights,
                    relevanceScore,
                },
            });

            return NextResponse.json({
                success: true,
                data: {
                    savedPaper: newPaper,
                    aiInsights,
                },
            });
        }

        return NextResponse.json(
            { success: false, error: 'Either savedPaperId or paperId is required' },
            { status: 400 }
        );
    } catch (error: any) {
        console.error('Error linking paper to project:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

/**
 * 获取论文详情
 */
async function fetchPaperDetails(paperId: string, projectId: string) {
    // 调用 Semantic Scholar 获取公开元数据。
    try {
        const response = await fetch(
            `https://api.semanticscholar.org/graph/v1/paper/${paperId}?fields=title,authors,year,abstract,openAccessPdf`,
            {
                headers: {
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(10_000),
            }
        );

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return {
            paperId,
            title: data.title,
            authors: data.authors?.map((a: any) => a.name) || [],
            year: data.year,
            abstract: data.abstract,
            pdfUrl: data.openAccessPdf?.url,
        };
    } catch (error) {
        console.error('Error fetching paper from Semantic Scholar:', error);
        return null;
    }
}

/**
 * 生成AI应用建议
 */
async function generateAIInsights(paper: any, project: any) {
    // 简化版本：基于规则生成建议
    // 在生产环境中，这里应该调用AI模型（如OpenAI GPT）

    let aiInsights = '';
    let relevanceScore = 0.7; // 默认相关性

    const projectType = project.type;
    const capacity = project.capacity;
    const paperTitle = paper.title?.toLowerCase() || '';
    const paperAbstract = paper.abstract?.toLowerCase() || '';

    // 基于关键词匹配生成建议
    if (projectType === 'SOLAR') {
        if (paperTitle.includes('efficiency') || paperAbstract.includes('efficiency')) {
            aiInsights = `该论文探讨了光伏系统效率优化方案，其中提到的技术方法可应用于您的${capacity}kW项目。建议在设计优化阶段参考论文中的组件选型标准和系统配置方案。`;
            relevanceScore = 0.9;
        } else if (paperTitle.includes('performance') || paperTitle.includes('degradation')) {
            aiInsights = `论文分析了光伏系统的长期性能表现和退化特性，可帮助您更好地预测项目的25年发电量曲线和维护需求。建议在经济性分析时参考其中的性能衰减模型。`;
            relevanceScore = 0.85;
        } else if (paperTitle.includes('economics') || paperTitle.includes('investment')) {
            aiInsights = `该研究提供了光伏项目经济性评估的详细方法论，包括IRR、LCOE等关键指标的计算。建议在项目可研阶段参考其分析框架。`;
            relevanceScore = 0.8;
        } else {
            aiInsights = `该论文与光伏发电技术相关，为您的${capacity}kW项目提供了理论参考和技术背景知识。`;
            relevanceScore = 0.6;
        }
    } else if (projectType === 'WIND') {
        if (paperTitle.includes('turbine') || paperAbstract.includes('wind energy')) {
            aiInsights = `论文研究了风电技术的最新进展，其中的技术方案和设计参数可为您的${capacity}kW分散式风电项目提供参考。`;
            relevanceScore = 0.85;
        } else {
            aiInsights = `该论文为您的风电项目提供了相关技术背景和行业趋势分析。`;
            relevanceScore = 0.65;
        }
    } else if (projectType === 'STORAGE') {
        if (paperTitle.includes('battery') || paperTitle.includes('storage')) {
            aiInsights = `该研究深入分析了储能系统的技术特性和经济模型，特别是峰谷套利策略，可直接应用于您的项目规划。`;
            relevanceScore = 0.9;
        } else {
            aiInsights = `论文中的储能相关内容可为您的项目提供技术参考。`;
            relevanceScore = 0.65;
        }
    }

    // 根据论文年份调整相关性
    if (paper.year >= 2022) {
        relevanceScore += 0.05;
        aiInsights += ' 该论文发表时间较新，反映了最新的技术趋势和研究成果。';
    }

    return {
        aiInsights: aiInsights.trim(),
        relevanceScore: Math.min(relevanceScore, 1.0),
    };
}
