import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    let userId = session?.user?.id || 'dev-master-id';

    try {
        const body = await req.json();
        const { comparisonResult } = body;

        if (!comparisonResult || !comparisonResult.lat || !comparisonResult.lng) {
            return NextResponse.json({ error: 'Missing comparison result data' }, { status: 400 });
        }

        // 创建永久项目记录
        const project = await prisma.project.create({
            data: {
                userId,
                name: comparisonResult.address || `${comparisonResult.lat.toFixed(2)},${comparisonResult.lng.toFixed(2)} 评估项目`,
                type: 'COMPARISON',
                lat: comparisonResult.lat,
                lng: comparisonResult.lng,
                capacity: 0, // 站点评估阶段容量暂定为0，由具体方案决定
                siteData: comparisonResult.resourceData,
                comparisonResult: comparisonResult,
                recommendedType: comparisonResult.recommendation?.type || comparisonResult.recommendedType,
                reportStatus: 'READY', // 模拟已付费解封，直接就绪
                parameters: {
                    address: comparisonResult.address,
                    source: 'wizard'
                }
            }
        });

        return NextResponse.json({ success: true, data: project });
    } catch (error) {
        console.error('Failed to unlock report:', error);
        return NextResponse.json({
            error: 'Failed to create project and unlock report',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
