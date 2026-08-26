import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import * as XLSX from 'xlsx';

import { addToExportCache } from '@/lib/exports/cache';

/**
 * 数据导出 API
 * 支持从数据库获取真实数据并导出为 CSV、JSON、Excel 格式
 */

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await req.json();
    const { dataType, format = 'csv' } = body;

    try {
        let headers: string[] = [];
        let rows: any[][] = [];
        let filenameBase = '';

        // 1. 获取真实数据
        switch (dataType) {
            case 'projects':
                filenameBase = `projects_export_${Date.now()}`;
                try {
                    const projects = await prisma.project.findMany({
                        where: { userId },
                        orderBy: { createdAt: 'desc' }
                    });

                    headers = ['ID', '项目名称', '类型', '容量(kW)', '经度', '纬度', '创建日期'];
                    rows = projects.map((p: any) => [
                        p.id,
                        p.name,
                        p.type === 'SOLAR' ? '光伏' : '风电',
                        p.capacity,
                        p.lng,
                        p.lat,
                        p.createdAt.toISOString().split('T')[0]
                    ]);
                } catch (dbError) {
                    console.error('Projects DB fetch failed:', dbError);
                    throw new Error('项目数据暂时无法读取，未导出示例数据');
                }
                break;

            case 'calculations':
                filenameBase = `calculations_history_${Date.now()}`;
                try {
                    const calculations = await prisma.calculation.findMany({
                        where: { userId },
                        orderBy: { createdAt: 'desc' },
                        take: 50
                    });

                    headers = ['ID', '类型', '输入参数', '年发电量(kWh)', '创建日期'];
                    rows = calculations.map((c: any) => [
                        c.id,
                        c.type,
                        JSON.stringify(c.input),
                        (c.output as any)?.energy?.annualGeneration || 'N/A',
                        c.createdAt.toISOString().split('T')[0]
                    ]);
                } catch (dbError) {
                    console.error('Calculations DB fetch failed:', dbError);
                    throw new Error('计算记录暂时无法读取，未导出示例数据');
                }
                break;

            case 'monitoring':
                return NextResponse.json({ success: false, error: 'MONITORING_SOURCE_UNAVAILABLE', message: '尚未接入经验证的监控数据源，未生成随机数据' }, { status: 503 });

            default:
                return NextResponse.json({
                    success: false,
                    error: `Unsupported data type: ${dataType}`
                }, { status: 400 });
        }

        const filename = `${filenameBase}.${format}`;
        let content: Buffer | string = '';
        let contentType = '';

        // 2. 生成对应格式的内容
        if (format === 'csv') {
            // CSV 转义：含逗号、双引号或换行的字段都要加引号，且内部双引号需翻倍。
            // 此前只处理了逗号，字段里出现引号或换行会把整份 CSV 结构破坏掉。
            const escapeCsvCell = (cell: any): string => {
                const s = cell === null || cell === undefined ? '' : String(cell);
                return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
            };
            content = [
                headers.map(escapeCsvCell).join(','),
                ...rows.map(row => row.map(escapeCsvCell).join(','))
            ].join('\n');
            // 加 UTF-8 BOM，避免 Excel 打开中文表头乱码
            content = '﻿' + content;
            contentType = 'text/csv; charset=utf-8';
        } else if (format === 'xlsx') {
            const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
            content = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        } else if (format === 'json') {
            const jsonData = rows.map(row => {
                const obj: any = {};
                headers.forEach((h, i) => obj[h] = row[i]);
                return obj;
            });
            content = JSON.stringify(jsonData, null, 2);
            contentType = 'application/json';
        }

        // 3. 存储到缓存并生成下载链接
        addToExportCache(filename, { content, format, contentType });

        const downloadUrl = `/api/exports/download/${filename}`;

        return NextResponse.json({
            success: true,
            data: {
                filename,
                format,
                downloadUrl,
                totalRecords: rows.length,
                size: content.length,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
                preview: {
                    headers,
                    sampleData: rows.slice(0, 3)
                }
            }
        });

    } catch (error: any) {
        console.error('Export failed:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Export failed'
        }, { status: 500 });
    }
}

// GET - 获取导出历史 (演示)
export async function GET() {
    return NextResponse.json({ success: true, data: [], message: '导出历史持久化尚未接入，未返回示例记录' });
}
