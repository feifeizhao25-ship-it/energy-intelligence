import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

import { discardPartial, publishPartial, startExportSweep } from '@/lib/exports/cache';
import { EXPORT_PAGE_SIZE, writeTabularExport, type ExportRow } from '@/lib/exports/stream';
import { checkQuota, consumeQuota } from '@/lib/audit/quota';
import { safeErrorMessage } from '@/lib/api/safe-error';

startExportSweep();

/**
 * 数据导出 API
 * 支持从数据库获取真实数据并导出为 CSV、JSON 格式
 */

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return NextResponse.json({ success: false, error: 'INVALID_REQUEST', message: '导出请求格式无效，请重试' }, { status: 400 });
    }
    const { dataType, format = 'csv' } = body;

    if (!['csv', 'json'].includes(format)) {
        return NextResponse.json({ error: 'UNSUPPORTED_FORMAT', message: '当前安全导出仅支持 CSV 和 JSON 格式' }, { status: 400 });
    }

    try {
        let headers: string[] = [];
        let filenameBase = '';
        let loadPage: (cursor: string | undefined) => Promise<ExportRow[]> = async () => [];

        switch (dataType) {
            case 'projects':
                filenameBase = `projects_export_${Date.now()}`;
                headers = ['ID', '项目名称', '类型', '容量(kW)', '经度', '纬度', '创建日期'];
                loadPage = async (cursor) => {
                    try {
                        const projects = await prisma.project.findMany({
                            where: { userId },
                            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                            take: EXPORT_PAGE_SIZE,
                            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
                            select: { id: true, name: true, type: true, capacity: true, lng: true, lat: true, createdAt: true },
                        });
                        return projects.map((p) => ({
                            id: p.id,
                            cells: [p.id, p.name, p.type === 'SOLAR' ? '光伏' : '风电', p.capacity, p.lng, p.lat, p.createdAt.toISOString().split('T')[0]],
                        }));
                    } catch (dbError) {
                        console.error('Projects DB fetch failed:', dbError);
                        throw new Error('项目数据暂时无法读取，未导出示例数据');
                    }
                };
                break;

            case 'calculations':
                filenameBase = `calculations_history_${Date.now()}`;
                headers = ['ID', '类型', '输入参数', '年发电量(kWh)', '创建日期'];
                loadPage = async (cursor) => {
                    try {
                        const calculations = await prisma.calculation.findMany({
                            where: { userId },
                            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                            take: EXPORT_PAGE_SIZE,
                            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
                            select: { id: true, type: true, input: true, output: true, createdAt: true },
                        });
                        return calculations.map((c) => ({
                            id: c.id,
                            cells: [c.id, c.type, JSON.stringify(c.input), (c.output as { energy?: { annualGeneration?: number } })?.energy?.annualGeneration ?? '暂无数据', c.createdAt.toISOString().split('T')[0]],
                        }));
                    } catch (dbError) {
                        console.error('Calculations DB fetch failed:', dbError);
                        throw new Error('计算记录暂时无法读取，未导出示例数据');
                    }
                };
                break;

            case 'monitoring':
                return NextResponse.json({ success: false, error: 'MONITORING_SOURCE_UNAVAILABLE', message: '尚未接入经验证的监控数据源，未生成随机数据' }, { status: 503 });

            default:
                return NextResponse.json({
                    success: false,
                    error: `不支持的数据类型：${dataType}`
                }, { status: 400 });
        }

        let gate;
        try {
            gate = await checkQuota(userId, 'EXPORTS', 1);
        } catch (error) {
            console.error('Export quota check failed:', error);
            return NextResponse.json({ success: false, error: 'EXPORT_QUOTA_UNAVAILABLE', message: '导出额度暂时无法核验，请稍后重试' }, { status: 503 });
        }
        if (!gate.allowed) {
            return NextResponse.json({
                success: false,
                error: 'EXPORT_QUOTA_EXCEEDED',
                message: '本月导出额度已用尽，请查看套餐或下月再试',
                usage: gate.usage,
            }, { status: 429 });
        }

        const filename = `${filenameBase}_${randomUUID()}.${format}`;
        const contentType = format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json';
        let staged;
        try {
            // 先按批写到临时文件。额度事务只做改名和元数据，避免大导出占住数据库锁。
            staged = await writeTabularExport({ format, headers, loadPage });
        } catch (error) {
            console.error('Export stream failed:', error);
            const message = safeErrorMessage(error, '');
            if (message) return NextResponse.json({ success: false, error: message }, { status: 500 });
            return NextResponse.json({ success: false, error: '导出失败，请稍后重试' }, { status: 503 });
        }

        const quota = await consumeQuota(userId, 'EXPORTS', 1, async () => {
            publishPartial(staged.partialPath, filename, { format, contentType, ownerId: userId });
        });
        if (!quota.success) {
            discardPartial(staged.partialPath, filename);
            return NextResponse.json({
                success: false,
                error: quota.usage.exceeded ? 'EXPORT_QUOTA_EXCEEDED' : 'EXPORT_QUOTA_UNAVAILABLE',
                message: quota.usage.exceeded ? '本月导出额度已用尽，请查看套餐或下月再试' : '导出额度暂时无法核验，请稍后重试',
                usage: quota.usage,
            }, { status: quota.usage.exceeded ? 429 : 503 });
        }

        const downloadUrl = `/api/exports/download/${filename}`;
        return NextResponse.json({
            success: true,
            data: {
                filename,
                format,
                downloadUrl,
                totalRecords: staged.records,
                size: staged.bytes,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
                preview: { headers, sampleData: staged.sample },
            }
        });

    } catch (error: any) {
        console.error('Export failed:', error);
        return NextResponse.json({
            success: false,
            error: safeErrorMessage(error, '导出失败，请稍后重试')
        }, { status: 500 });
    }
}

// GET - 获取导出历史 (演示)
export async function GET() {
    return NextResponse.json({ success: true, data: [], message: '导出历史持久化尚未接入，未返回示例记录' });
}
