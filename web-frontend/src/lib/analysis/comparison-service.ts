/**
 * 🏰 护城河系统：方案对比分析服务
 * 核心目标：通过对比不同计算方案（不同设备、不同贷款、不同电价），锁定用户决策
 */

import { prisma } from '@/lib/prisma';

export interface ComparisonResult {
    summary: string;
    differences: Array<{
        metric: string;
        left: any;
        right: any;
        delta: number | string;
        impact: 'positive' | 'negative' | 'neutral';
    }>;
    recommendation: string;
}

export class ComparisonService {
    /**
     * 对比两个计算快照
     */
    async compareSnapshots(leftId: string, rightId: string): Promise<ComparisonResult> {
        const left = await prisma.calculationSnapshot.findUnique({ where: { id: leftId } });
        const right = await prisma.calculationSnapshot.findUnique({ where: { id: rightId } });

        if (!left || !right) throw new Error('Snapshots not found');

        const leftOut = left.outputSnapshot as any;
        const rightOut = right.outputSnapshot as any;

        const differences = [
            {
                metric: '内部收益率 (IRR)',
                left: leftOut.irr,
                right: rightOut.irr,
                delta: rightOut.irr - leftOut.irr,
                impact: rightOut.irr > leftOut.irr ? 'positive' : 'negative'
            },
            {
                metric: '回本周期',
                left: leftOut.paybackYears,
                right: rightOut.paybackYears,
                delta: leftOut.paybackYears - rightOut.paybackYears, // 回本越短越好
                impact: rightOut.paybackYears < leftOut.paybackYears ? 'positive' : 'negative'
            },
            {
                metric: '25年总利润',
                left: leftOut.netProfit25Y,
                right: rightOut.netProfit25Y,
                delta: rightOut.netProfit25Y - leftOut.netProfit25Y,
                impact: rightOut.netProfit25Y > leftOut.netProfit25Y ? 'positive' : 'negative'
            }
        ];

        // AI 辅助分析摘要（此处为模拟逻辑）
        const winner = rightOut.irr > leftOut.irr ? '方案 B' : '方案 A';
        const summary = `${winner} 在财务表现上更优。主要差异在于 ${differences[0].metric} 提升了 ${Math.abs(differences[0].delta as number * 100).toFixed(2)}%。`;
        const recommendation = `考虑到资金成本，建议优先执行 ${winner}。`;

        // 记录对比事件到时间线
        await prisma.projectComparison.create({
            data: {
                projectId: left.projectId!,
                comparisonType: 'SCENARIO',
                leftSnapshot: left.id as any,
                rightSnapshot: right.id as any,
                differences: differences as any,
                summary,
            }
        });

        return { summary, differences, recommendation };
    }
}

export const comparisonService = new ComparisonService();
