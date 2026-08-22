import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { simpleChat } from '@/lib/ai/unified';

type DiagnosisResult = {
    summary: string;
    status: 'healthy' | 'warning' | 'critical';
    scores: { overall: number; efficiency: number; maintenance: number; safety: number };
    issues: Array<{ type: 'warning' | 'error' | 'info'; title: string; description: string; recommendation: string }>;
    recommendations: string[];
    nextMaintenanceDate: string;
};

function isDiagnosis(value: unknown): value is DiagnosisResult {
    const item = value as DiagnosisResult;
    const scores = item?.scores;
    return Boolean(
        item && typeof item.summary === 'string' &&
        ['healthy', 'warning', 'critical'].includes(item.status) &&
        scores && [scores.overall, scores.efficiency, scores.maintenance, scores.safety]
            .every(score => Number.isFinite(score) && score >= 0 && score <= 100) &&
        Array.isArray(item.issues) && Array.isArray(item.recommendations) &&
        /^\d{4}-\d{2}-\d{2}$/.test(item.nextMaintenanceDate)
    );
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { projectId } = await req.json();
        if (!projectId) return NextResponse.json({ error: '缺少 projectId' }, { status: 400 });
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
            actualGeneration: Number(row.generationActual),
            expectedGeneration: Number(row.generationExpected),
            performanceRatio: Number(row.pr),
            healthScore: Number(row.healthScore),
            faultCount: row.faultCount,
        }));
        const prompt = `你是新能源电站运维专家。只能依据下面来自数据库的最近运行记录诊断，不得补造设备、故障、数值或原因。无法从证据判断的字段必须明确写“证据不足”。\n项目：${JSON.stringify({ id: project.id, name: project.name, type: project.type, capacity: project.capacity, location: project.location })}\n运行证据：${JSON.stringify(evidence)}\n只返回 JSON，结构为 {"summary":"", "status":"healthy|warning|critical", "scores":{"overall":0,"efficiency":0,"maintenance":0,"safety":0}, "issues":[{"type":"warning|error|info","title":"","description":"","recommendation":""}], "recommendations":[""], "nextMaintenanceDate":"YYYY-MM-DD"}。`;
        const raw = await simpleChat(prompt, 'deepseek-v3');
        const diagnosis = JSON.parse(raw.replace(/```json|```/g, '').trim());
        if (!isDiagnosis(diagnosis)) throw new Error('AI 返回的诊断结构未通过校验');

        return NextResponse.json({
            success: true,
            data: diagnosis,
            evidence: { source: 'daily_analysis', records: evidence.length, latestAt: evidence[0].date },
        });
    } catch (error) {
        console.error('AI Diagnosis failed:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '诊断服务暂时不可用' },
            { status: 503 }
        );
    }
}
