// API: 获取当前用户会员信息
import { NextRequest, NextResponse } from 'next/server';

// Mock user data - 实际应从数据库获取
export async function GET(req: NextRequest) {
    try {
        // TODO: 从session/JWT获取用户ID
        const userId = 'user_123';

        // TODO: 从数据库查询用户信息
        const user = {
            id: userId,
            name: '张三',
            email: 'zhang@example.com',
            plan: 'FULL',
            planExpireAt: new Date('2027-01-06').toISOString(),

            // 每日使用量
            dailyAiCalls: 245,
            dailyResourceQueries: 38,
            dailyCalculations: 28,
            dailyPaperSearches: 67,
            dailyDiagnoses: 15,
            lastResetAt: new Date().toISOString(),

            // 存储统计
            projectCount: 45,
            paperCount: 156,
            stationCount: 8,
            folderCount: 12,
        };

        return NextResponse.json({
            success: true,
            data: user,
        });
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: 'INTERNAL_ERROR',
                message: '获取用户信息失败',
            },
            { status: 500 }
        );
    }
}
