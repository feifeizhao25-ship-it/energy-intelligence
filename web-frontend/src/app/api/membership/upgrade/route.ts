// API: 创建订单/升级会员
import { NextRequest, NextResponse } from 'next/server';
import { Plan, PLAN_DETAILS } from '@/lib/membership/plans';

interface UpgradeRequest {
    plan: Plan;
    billingPeriod: 'monthly' | 'yearly';
    discountCode?: string;
}

export async function POST(req: NextRequest) {
    try {
        const body: UpgradeRequest = await req.json();
        const { plan, billingPeriod, discountCode } = body;

        // TODO: 验证用户登录状态
        const userId = 'user_123';

        // 获取计划价格
        const planDetails = PLAN_DETAILS[plan];
        if (!planDetails) {
            return NextResponse.json(
                { success: false, error: 'INVALID_PLAN', message: '无效的会员计划' },
                { status: 400 }
            );
        }

        const price = billingPeriod === 'monthly' ? planDetails.monthlyPrice : planDetails.yearlyPrice;

        if (price === 0 && plan !== 'FREE') {
            return NextResponse.json(
                { success: false, error: 'INVALID_BILLING', message: '此计划不支持月付' },
                { status: 400 }
            );
        }

        // 计算折扣
        let discountPercent = 0;
        let discountAmount = 0;

        if (discountCode) {
            // TODO: 从数据库验证优惠码
            // 示例: STUDENT50 = 50% off
            if (discountCode === 'STUDENT50') {
                discountPercent = 50;
                discountAmount = Math.floor(price * 0.5);
            } else if (discountCode === 'EARLY30') {
                discountPercent = 30;
                discountAmount = Math.floor(price * 0.3);
            }
        }

        const finalAmount = price - discountAmount;

        // 生成订单号
        const orderNo = `ORD${Date.now()}${Math.random().toString(36).substring(7).toUpperCase()}`;

        // TODO: 保存订单到数据库
        const order = {
            id: `order_${Date.now()}`,
            orderNo,
            userId,
            type: 'subscribe',
            plan,
            amount: finalAmount,
            originalAmount: price,
            discountAmount,
            discountCode,
            paymentStatus: 'pending',
            createdAt: new Date().toISOString(),
        };

        // 返回支付信息
        return NextResponse.json({
            success: true,
            data: {
                order,
                paymentUrl: `/payment?orderNo=${orderNo}`, // 实际应该是支付网关URL
            },
        });
    } catch (error) {
        console.error('Create order error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'INTERNAL_ERROR',
                message: '创建订单失败',
            },
            { status: 500 }
        );
    }
}
