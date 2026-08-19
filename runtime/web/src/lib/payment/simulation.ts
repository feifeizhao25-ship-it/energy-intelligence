/**
 * 模拟支付系统 - 仅用于生产预备期的流程闭环演示
 */

export type PaymentMethod = 'wechat' | 'alipay';

export interface PaymentRequest {
    planId: string;
    amount: number; // 分
    method: PaymentMethod;
}

export interface PaymentResult {
    success: boolean;
    orderNo: string;
    transactionId?: string;
    error?: string;
}

/**
 * 模拟创建支付订单
 */
export async function createMockPayment(req: PaymentRequest): Promise<PaymentResult> {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 1500));

    const orderNo = `ORDER_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // 模拟支付逻辑 - 这里我们总是假设成功，或者根据金额模拟失败
    if (req.amount <= 0) {
        return {
            success: false,
            orderNo,
            error: '订单金额无效'
        };
    }

    return {
        success: true,
        orderNo,
        transactionId: `TXN_${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    };
}

/**
 * 生成模拟的二维码链接 (实际上指向一个支付处理页)
 */
export function generateMockQrCode(orderNo: string, method: PaymentMethod) {
    // 在实际生产中这里是微信/支付宝的支付链接
    // 这里我们返回一个应用内的路由
    return `/checkout/process?orderNo=${orderNo}&method=${method}`;
}
