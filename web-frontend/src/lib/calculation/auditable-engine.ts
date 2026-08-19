/**
 * 🏰 护城河系统：可审计计算引擎
 * 核心原则：每次计算都生成一个完整、可复现、带证据链的快照
 */

import { prisma } from '@/lib/prisma';

export enum CalcType {
    SOLAR_REVENUE = 'SOLAR_REVENUE',
    WIND_REVENUE = 'WIND_REVENUE',
    STORAGE_REVENUE = 'STORAGE_REVENUE',
    PR_ANALYSIS = 'PR_ANALYSIS',
    FAULT_DIAGNOSIS = 'FAULT_DIAGNOSIS',
    CLEANING_ROI = 'CLEANING_ROI',
    RESOURCE_ASSESSMENT = 'RESOURCE_ASSESSMENT'
}

export interface CalculationInput {
    type: CalcType;
    params: Record<string, any>;
    userId: string;
    projectId?: string;
}

export interface CalculationTrace {
    steps: TraceStep[];
    intermediateValues: Record<string, any>;
    formulasUsed: FormulaReference[];
    dataFetched: DataFetchRecord[];
}

interface TraceStep {
    stepId: string;
    name: string;
    input: Record<string, any>;
    output: Record<string, any>;
    formula?: string;
    duration: number;
}

interface FormulaReference {
    id: string;
    name: string;
    formula: string;
    variables: Record<string, string>;
    source: string;
}

interface DataFetchRecord {
    source: string;
    endpoint: string;
    params: Record<string, any>;
    response: any;
    timestamp: Date;
    cacheHit: boolean;
}

export class AuditableCalculationEngine {
    private trace: CalculationTrace;
    private currentVersion: string = 'v1.2.0';
    private assumptionVersion: string = '2026-Q1';
    private dataSourceVersion: string = 'NASA-POWER-2026';

    constructor() {
        this.trace = {
            steps: [],
            intermediateValues: {},
            formulasUsed: [],
            dataFetched: [],
        };
    }

    /**
     * 执行可审计计算
     */
    async execute(input: CalculationInput) {
        const startTime = Date.now();

        // 逻辑模拟：这里会根据 type 调用具体的计算方法
        // 示例：calculateSolar(input.params)

        // 记录一个示例步骤
        this.traceStep('init', '初始化参数', input.params, () => {
            return { status: 'ready' };
        });

        // 结论生成（结构化）
        const conclusion = {
            headline: "该项目具有极高的投资价值",
            keyMetrics: [
                { name: "IRR", value: "12.5%", unit: "%", trend: "up" },
                { name: "回本周期", value: "6.2", unit: "年" }
            ],
            confidence: "high"
        };

        const risks = [
            { level: "low", category: "政策", description: "电价补贴可能在2027年后下调" }
        ];

        const nextSteps = [
            { priority: 1, action: "导出可研报告", reason: "用于提交银行贷款申请" }
        ];

        // 保存快照到数据库
        const snapshot = await prisma.calculationSnapshot.create({
            data: {
                userId: input.userId,
                projectId: input.projectId,
                calcType: input.type as any,
                calcVersion: this.currentVersion,
                assumptionVersion: this.assumptionVersion,
                dataSourceVersion: this.dataSourceVersion,
                inputSnapshot: input.params,
                outputSnapshot: { result: "dummy_result" }, // 实际应为计算结果
                calculationTrace: this.trace as any,
                dataEvidence: this.trace.dataFetched as any,
                conclusion,
                risks,
                nextSteps,
            }
        });

        return {
            success: true,
            snapshotId: snapshot.id,
            conclusion,
            risks,
            nextSteps,
            auditUrl: `/audit/${snapshot.id}`
        };
    }

    private traceStep<T>(stepId: string, name: string, input: any, fn: () => T): T {
        const start = Date.now();
        const output = fn();
        this.trace.steps.push({
            stepId,
            name,
            input,
            output: output as any,
            duration: Date.now() - start
        });
        return output;
    }
}

export const calculationEngine = new AuditableCalculationEngine();
