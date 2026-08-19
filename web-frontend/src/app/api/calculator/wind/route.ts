// API: 分散式风电收益计算
import { NextRequest, NextResponse } from 'next/server';
import { calculateWind } from '@/lib/calculator/wind';
import { withMembershipCheck } from '@/lib/membership/middleware';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    return withMembershipCheck(
        req,
        { usageType: 'calculation' },
        async (user) => {
            try {
                const input = await req.json();
                const result = await calculateWind(input);

                try {
                    await prisma.calculation.create({
                        data: {
                            userId: user.id,
                            type: 'WIND',
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
