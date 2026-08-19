import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    const status = {
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        services: {
            database: 'down',
            environment: process.env.NODE_ENV,
            version: '1.0.0'
        }
    };

    try {
        // 检查数据库连接
        await prisma.$queryRaw`SELECT 1`;
        status.services.database = 'up';

        return NextResponse.json(status, { status: 200 });
    } catch (error) {
        console.error('Health Check Error:', error);
        return NextResponse.json(status, { status: 503 });
    }
}
