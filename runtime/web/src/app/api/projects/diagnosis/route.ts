import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { simpleChat } from '@/lib/ai/unified';

type DiagnosisResult = {
    summary: string;
    status: 'healthy' | 'warning' | 'critical' | 'unknown';
    scores: { overall: number | null; efficiency: number | null; maintenance: number | null; safety: number | null };
    issues: Array<{ type: 'warning' | 'error' | 'info'; title: string; description: string; recommendation: string }>;
    recommendations: string[];
    nextMaintenanceDate: string | null;
};

function isDiagnosis(value: unknown): value is DiagnosisResult {
    const item = value as DiagnosisResult;
    const scores = item?.scores;
    return Boolean(
        item && typeof item.summary === 'string' &&
        ['healthy', 'warning', 'critical', 'unknown'].includes(item.status) &&
        scores && [scores.overall, scores.efficiency, scores.maintenance, scores.safety]
            .every(score => score === null || (typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100)) &&
        Array.isArray(item.issues) && item.issues.every(issue => issue &&
            ['warning', 'error', 'info'].includes(issue.type) &&
            [issue.title, issue.description, issue.recommendation].every(value => typeof value === 'string')) &&
        Array.isArray(item.recommendations) && item.recommendations.every(value => typeof value === 'string') &&
        item.nextMaintenanceDate === null
    );
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    try {
        const body = await req.json().catch(() => null);
        const projectId = body?.projectId;
        if (typeof projectId !== 'string' || !projectId.trim()) return NextResponse.json({ error: '请选择有效的项目' }, { status: 400 });
        const project = await prisma.project.findFirst({
            where: { id: String(projectId), userId: session.user.id },
            include: { dailyAnalyses: { orderBy: { analysisDate: 'desc' }, take: 7 } },
        });
        if (!project) return NextResponse.json({ error: '项目不存在或无权访问' }, { status: 404 });
        if (project.dailyAnalyses.length === 0) {
            return NextResponse.json(
                { error: '缺少真实运行数据，无法生成可靠诊断', code: 'NO_VERIFIED_TELEMETRY' },
                { status: 422 }
            );
        }

        const evidence = project.dailyAnalyses.map(row => ({
            date: row.analysisDate.toISOString().slice(0, 10),
            actualGeneration: row.generationActual == null ? null : Number(row.generationActual),
            expectedGeneration: row.generationExpected == null ? null : Number(row.generationExpected),
            performanceRatio: row.pr == null ? null : Number(row.pr),
            healthScore: row.healthScore == null ? null : Number(row.healthScore),
            faultCount: row.faultCount,
        }));
        const prompt = `你是新能源电站运维专家。只能依据下面来自数据库的最近运行记录诊断，不得补造设备、故障、数值或原因。无法从证据判断的字段必须明确写“证据不足”。当前没有经过验证的评分规则和设备维护规程，禁止给出评分或维护日期，scores 四项和 nextMaintenanceDate 必须为 null；没有故障记录也不能断言设备健康。\n项目：${JSON.stringify({ id: project.id, name: project.name, type: project.type, capacity: project.capacity, location: project.location })}\n运行证据：${JSON.stringify(evidence)}\n只返回 JSON，结构为 {"summary":"", "status":"unknown", "scores":{"overall":null,"efficiency":null,"maintenance":null,"safety":null}, "issues":[{"type":"warning|error|info","title":"","description":"","recommendation":""}], "recommendations":[""], "nextMaintenanceDate":null}。`;
        const raw = await simpleChat(prompt, 'deepseek-v3');
        const diagnosis = JSON.parse(raw.replace(/```json|```/g, '').trim());
        if (diagnosis && typeof diagnosis === 'object' && !Array.isArray(diagnosis)) {
            // No validated scoring rubric or maintenance schedule is stored for this endpoint.
            // Model guesses must not become operational numbers or dates.
            diagnosis.scores = { overall: null, efficiency: null, maintenance: null, safety: null };
            diagnosis.nextMaintenanceDate = null;
            diagnosis.status = evidence.some(row => row.faultCount > 0) ? 'warning' : 'unknown';
        }
        if (!isDiagnosis(diagnosis)) throw new Error('AI 返回的诊断结构未通过校验');

        return NextResponse.json({
            success: true,
            data: diagnosis,
            evidence: { source: 'daily_analysis', records: evidence.length, latestAt: evidence[0].date },
        });
    } catch {
        return NextResponse.json(
            { error: '诊断服务暂时不可用，请稍后重试' },
            { status: 503 }
        );
    }
}
