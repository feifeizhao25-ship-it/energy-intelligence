// API: 能源存储系统收益计算
import { NextRequest, NextResponse } from 'next/server';
import { calculateStorage } from '@/lib/calculator/storage';
import { withMembershipCheck } from '@/lib/membership/middleware';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    return withMembershipCheck(
        req,
        { usageType: 'calculation' },
        async (user) => {
            try {
                const input = await req.json();
                const result = await calculateStorage(input);

                try {
                    await prisma.calculation.create({
                        data: {
                            userId: user.id,
                            type: 'STORAGE',
                            input: input,
                            output: result
                        }
                    });
                } catch (dbError) {
                    console.error('Database logging failed:', dbError);
                }

                return NextResponse.json({ success: true, data: result });
            } catch (error) {
                return NextResponse.json(
                    { error: 'CALCULATION_ERROR', message: error instanceof Error ? error.message : '计算失败' },
                    { status: 500 }
                );
            }
        }
    );
}
