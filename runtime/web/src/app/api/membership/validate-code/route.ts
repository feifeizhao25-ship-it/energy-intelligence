// API: 验证优惠码
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { code, plan } = await req.json();

        if (!code) {
            return NextResponse.json(
                { success: false, error: 'INVALID_CODE', message: '请输入优惠码' },
                { status: 400 }
            );
        }

        // TODO: 从数据库查询优惠码
        // 示例优惠码
        const discountCodes: Record<
            string,
            {
                discountPercent: number;
                applicablePlans: string[];
                maxUses?: number;
                usedCount: number;
                validUntil: string;
                description: string;
            }
        > = {
            STUDENT50: {
                discountPercent: 50,
                applicablePlans: ['PRO', 'MAINTENANCE', 'FULL'],
                description: '学生优惠 5折',
                usedCount: 234,
                maxUses: 1000,
                validUntil: '2026-12-31',
            },
            EARLY30: {
                discountPercent: 30,
                applicablePlans: ['PRO', 'MAINTENANCE', 'FULL', 'TEAM', 'ENTERPRISE'],
                description: '早鸟价 7折',
                usedCount: 567,
                maxUses: 1000,
                validUntil: '2026-03-31',
            },
            NEWYEAR20: {
                discountPercent: 20,
                applicablePlans: ['PRO', 'MAINTENANCE', 'FULL'],
                description: '新年优惠 8折',
                usedCount: 123,
                validUntil: '2026-02-15',
            },
        };

        const discount = discountCodes[code.toUpperCase()];

        if (!discount) {
            return NextResponse.json(
                { success: false, error: 'CODE_NOT_FOUND', message: '优惠码不存在' },
                { status: 404 }
            );
        }

        // 检查是否过期
        if (new Date(discount.validUntil) < new Date()) {
            return NextResponse.json(
                { success: false, error: 'CODE_EXPIRED', message: '优惠码已过期' },
                { status: 400 }
            );
        }

        // 检查使用次数
        if (discount.maxUses && discount.usedCount >= discount.maxUses) {
            return NextResponse.json(
                { success: false, error: 'CODE_EXHAUSTED', message: '优惠码已用完' },
                { status: 400 }
            );
        }

        // 检查是否适用于该计划
        if (plan && !discount.applicablePlans.includes(plan)) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'CODE_NOT_APPLICABLE',
                    message: '该优惠码不适用于此会员计划',
                },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                code: code.toUpperCase(),
                discountPercent: discount.discountPercent,
                description: discount.description,
                validUntil: discount.validUntil,
            },
        });
    } catch (error) {
        console.error('Validate discount code error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'INTERNAL_ERROR',
                message: '验证优惠码失败',
            },
            { status: 500 }
        );
    }
}
