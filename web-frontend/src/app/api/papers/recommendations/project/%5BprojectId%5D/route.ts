import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/papers/recommendations/project/[projectId]
 * 为特定项目推荐相关文献
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { projectId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { projectId } = params;

        // 获取项目信息
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
                lat: true,
                lng: true,
            },
        });

        if (!project) {
            return NextResponse.json(
                { success: false, error: 'Project not found' },
                { status: 404 }
            );
        }

        // 检查是否已有推荐
        const existingRecommendations = await prisma.projectPaperRecommendation.findMany({
            where: { projectId },
            orderBy: { score: 'desc' },
            take: 10,
        });

        // 如果已有推荐且是最近生成的（24小时内），直接返回
        if (existingRecommendations.length > 0) {
            const latestRec = existingRecommendations[0];
            const hoursSinceCreation =
                (Date.now() - new Date(latestRec.createdAt).getTime()) / (1000 * 60 * 60);

            if (hoursSinceCreation < 24) {
                return NextResponse.json({
                    success: true,
                    data: {
                        recommendations: existingRecommendations.filter(r => r.status !== 'dismissed'),
                        fromCache: true,
                    },
                });
            }
        }

        // 生成新的推荐
        const recommendations = await generatePaperRecommendations(project);

        // 保存到数据库
        if (recommendations.length > 0) {
            await prisma.projectPaperRecommendation.createMany({
                data: recommendations.map((rec) => ({
                    projectId,
                    paperId: rec.paperId,
                    title: rec.title,
                    authors: rec.authors,
                    abstract: rec.abstract,
                    year: rec.year,
                    reason: rec.reason,
                    score: rec.score,
                })),
                skipDuplicates: true,
            });
        }

        return NextResponse.json({
            success: true,
            data: {
                recommendations,
                fromCache: false,
            },
        });
    } catch (error: any) {
        console.error('Error generating paper recommendations:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

/**
 * 为项目生成文献推荐
 */
async function generatePaperRecommendations(project: any) {
    // 根据项目类型构建搜索查询
    const queries = buildSearchQueries(project);

    const allPapers = [];

    for (const query of queries) {
        try {
            // 调用 Semantic Scholar API
            const papers = await searchSemanticScholar(query.search, query.limit);

            // 为每篇论文计算相关性并添加推荐理由
            const scoredPapers = papers.map((paper: any) => ({
                paperId: paper.paperId,
                title: paper.title,
                authors: paper.authors?.map((a: any) => a.name) || [],
                abstract: paper.abstract,
                year: paper.year,
                citationCount: paper.citationCount || 0,
                reason: generateRecommendationReason(paper, project, query.category),
                score: calculateRelevanceScore(paper, project, query.category),
            }));

            allPapers.push(...scoredPapers);
        } catch (error) {
            console.error(`Error searching for ${query.search}:`, error);
        }
    }

    // 去重并按分数排序
    const uniquePapers = deduplicatePapers(allPapers);
    return uniquePapers.sort((a, b) => b.score - a.score).slice(0, 10);
}

/**
 * 根据项目类型构建搜索查询
 */
function buildSearchQueries(project: any) {
    const baseQueries = [];

    if (project.type === 'SOLAR') {
        baseQueries.push(
            {
                search: `photovoltaic solar efficiency ${project.capacity}kW`,
                category: 'efficiency',
                limit: 5,
            },
            {
                search: 'solar panel degradation performance ratio',
                category: 'performance',
                limit: 3,
            },
            {
                search: 'solar energy economics investment residential',
                category: 'economics',
                limit: 3,
            }
        );
    } else if (project.type === 'WIND') {
        baseQueries.push(
            {
                search: `wind turbine efficiency ${project.capacity}kW distributed`,
                category: 'efficiency',
                limit: 5,
            },
            {
                search: 'wind energy economics small-scale',
                category: 'economics',
                limit: 3,
            }
        );
    } else if (project.type === 'STORAGE') {
        baseQueries.push(
            {
                search: 'battery energy storage systems efficiency',
                category: 'technology',
                limit: 5,
            },
            {
                search: 'energy storage peak-valley arbitrage economics',
                category: 'economics',
                limit: 3,
            }
        );
    }

    return baseQueries;
}

/**
 * 调用 Semantic Scholar API
 */
async function searchSemanticScholar(query: string, limit: number = 5) {
    const response = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=paperId,title,abstract,year,authors,citationCount`,
        {
            headers: {
                'Content-Type': 'application/json',
            },
        }
    );

    if (!response.ok) {
        throw new Error(`Semantic Scholar API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
}

/**
 * 生成推荐理由
 */
function generateRecommendationReason(
    paper: any,
    project: any,
    category: string
): string {
    const reasons = {
        efficiency: `该论文研究了${project.type === 'SOLAR' ? '光伏' : '风电'}系统的效率优化，对您的${project.capacity}kW项目具有参考价值。`,
        performance: `论文分析了系统性能和退化特性，可帮助您预测项目长期表现。`,
        economics: `该研究提供了详细的经济性分析方法，适用于您的项目投资评估。`,
        technology: `论文探讨了最新技术发展，对项目设计和组件选型有指导意义。`,
    };

    return reasons[category as keyof typeof reasons] || '该论文与您的项目高度相关，建议阅读。';
}

/**
 * 计算相关性分数
 */
function calculateRelevanceScore(
    paper: any,
    project: any,
    category: string
): number {
    let score = 0.5; // 基础分

    // 根据类别加权
    const categoryWeights: Record<string, number> = {
        efficiency: 1.0,
        performance: 0.9,
        economics: 0.85,
        technology: 0.8,
    };
    score *= categoryWeights[category] || 0.7;

    // 引用次数加分（归一化）
    if (paper.citationCount) {
        score += Math.min(paper.citationCount / 1000, 0.2);
    }

    // 年份加分（越新越好）
    if (paper.year >= 2020) {
        score += 0.15;
    } else if (paper.year >= 2015) {
        score += 0.05;
    }

    // 有摘要加分
    if (paper.abstract && paper.abstract.length > 100) {
        score += 0.1;
    }

    return Math.min(score, 1.0);
}

/**
 * 去重论文
 */
function deduplicatePapers(papers: any[]) {
    const seen = new Set();
    return papers.filter((paper) => {
        if (seen.has(paper.paperId)) {
            return false;
        }
        seen.add(paper.paperId);
        return true;
    });
}
