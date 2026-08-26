// API: 获取所有会员计划
import { NextResponse } from 'next/server';
import { PLAN_DETAILS, USAGE_LIMITS, FEATURE_ACCESS } from '@/lib/membership/plans';

export async function GET() {
    try {
        const plans = Object.entries(PLAN_DETAILS).map(([key, details]) => ({
            id: key,
            ...details,
            limits: USAGE_LIMITS[key as keyof typeof USAGE_LIMITS],
            features: Object.entries(FEATURE_ACCESS).reduce((acc, [feature, allowedPlans]) => {
                acc[feature] = (allowedPlans as readonly string[]).includes(key);
                return acc;
            }, {} as Record<string, boolean>),
        }));

        return NextResponse.json({
            success: true,
            data: plans,
        });
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: 'INTERNAL_ERROR',
                message: '获取会员计划失败',
            },
            { status: 500 }
        );
    }
}
