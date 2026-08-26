// 项目生命周期编排器 - 类型定义
// v1.1 核心数据结构

/**
 * 生命周期阶段定义
 * 8个阶段覆盖项目全生命周期
 */
export type LifecycleStage =
    | 'ONBOARDING'              // 新手引导/首次创建项目
    | 'SITE_SELECTION'          // 选址与资源评估
    | 'ECONOMIC_EVALUATION'     // 收益测算（PV/Wind/Storage）
    | 'DESIGN_OPTIMIZATION'     // 方案优化/敏感性/多站比选
    | 'DECISION_REPORTING'      // 生成报告/对老板汇报
    | 'CONSTRUCTION_PREP'       // 开工前准备（预留接口）
    | 'OPERATION_MONITORING'    // 运行记录/监控
    | 'ABNORMAL_DIAGNOSIS'      // 异常诊断（PR/逆变器/组串/IV）
    | 'MAINTENANCE_OPTIMIZATION'// 清洗/预测性维护/检修窗口
    | 'KNOWLEDGE_RESEARCH';     // 论文/RAG/社区

/**
 * 阶段元信息（用于 UI 展示）
 */
export const STAGE_META: Record<LifecycleStage, {
    name: string;
    nameEn: string;
    icon: string;
    color: string;
    order: number;
}> = {
    ONBOARDING: { name: '新手入门', nameEn: 'Onboarding', icon: '🚀', color: 'blue', order: 0 },
    SITE_SELECTION: { name: '选址评估', nameEn: 'Site Selection', icon: '📍', color: 'green', order: 1 },
    ECONOMIC_EVALUATION: { name: '收益测算', nameEn: 'Economic Evaluation', icon: '💰', color: 'amber', order: 2 },
    DESIGN_OPTIMIZATION: { name: '方案优化', nameEn: 'Design Optimization', icon: '⚙️', color: 'purple', order: 3 },
    DECISION_REPORTING: { name: '决策报告', nameEn: 'Decision Report', icon: '📊', color: 'indigo', order: 4 },
    CONSTRUCTION_PREP: { name: '开工准备', nameEn: 'Construction Prep', icon: '🏗️', color: 'orange', order: 5 },
    OPERATION_MONITORING: { name: '运行监控', nameEn: 'Operation Monitoring', icon: '📈', color: 'teal', order: 6 },
    ABNORMAL_DIAGNOSIS: { name: '异常诊断', nameEn: 'Diagnosis', icon: '🔍', color: 'red', order: 7 },
    MAINTENANCE_OPTIMIZATION: { name: '维护优化', nameEn: 'Maintenance', icon: '🔧', color: 'slate', order: 8 },
    KNOWLEDGE_RESEARCH: { name: '知识研究', nameEn: 'Research', icon: '📚', color: 'cyan', order: 9 },
};

/**
 * 项目类型
 */
export type ProjectType = 'SOLAR' | 'WIND' | 'STORAGE' | 'HYBRID';

/**
 * 计算结果质量标签
 */
export type QualityTag = 'PREVIEW' | 'FULL';

/**
 * 诊断严重程度
 */
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * ActionCard 动作类别
 */
export type ActionCategory =
    | 'RESOURCE'
    | 'CALCULATION'
    | 'DIAGNOSIS'
    | 'REPORT'
    | 'RESEARCH'
    | 'COMMUNITY'
    | 'SETTINGS';

/**
 * CTA 调用类型
 */
export type CTAType = 'NAVIGATE' | 'OPEN_MODAL' | 'RUN_TOOL';

/**
 * 推荐理由类型
 */
export type RationaleType = 'RULE' | 'DATA' | 'AI';

/**
 * 项目快照（当前状态摘要）
 */
export interface ProjectSnapshot {
    location?: {
        lat: number;
        lng: number;
        address?: string;
        city?: string;
    };
    type?: ProjectType;
    capacity?: number;

    // 最近一次关键计算结果
    lastCalculation?: {
        type: ProjectType;
        irr?: number;
        paybackYears?: number;
        lcoe?: number;
        totalRevenue?: number;
        updatedAt: string;
        qualityTag: QualityTag;
    };

    // 最近一次诊断结果
    lastDiagnosis?: {
        type: 'PR' | 'INVERTER' | 'STRING' | 'IV' | 'CLEANING';
        healthScore?: number;
        pr?: number;
        severity?: Severity;
        updatedAt: string;
    };

    // 电站运行数据
    stationStats?: {
        totalGeneration: number;    // 累计发电量 kWh
        totalRevenue: number;       // 累计收益 ¥
        lastRecordDate?: string;
        recordCount: number;
    };

    // 论文/研究
    paperCount?: number;
}

/**
 * ActionCard - 推荐动作卡片
 */
export interface ActionCard {
    id: string;
    title: string;
    description: string;
    priority: 1 | 2 | 3;           // 1 = 最高优先级

    category: ActionCategory;

    // 点击后的行为
    cta: {
        type: CTAType;
        target: string;              // 路由 / modalKey / toolName
        params?: Record<string, unknown>;
    };

    // 推荐理由（增强信任 + 专业感）
    rationale: {
        type: RationaleType;
        summary: string;             // 一句话理由
        evidence?: string[];         // 2-3条证据
    };

    // 是否需要付费版
    requiresPlan?: 'PRO' | 'ENTERPRISE';

    // 是否已完成
    completed?: boolean;
}

/**
 * ChecklistItem - 阶段任务清单项
 */
export interface ChecklistItem {
    key: string;
    label: string;
    done: boolean;
    recommended: boolean;         // 当前是否推荐做
    link?: string;                // 页面路由
}

/**
 * PaywallHint - 付费墙触发点
 */
export interface PaywallHint {
    featureKey: string;           // 'IRR_DETAIL' | 'IV_ANALYSIS' | ...
    reason: string;               // '查看完整 IRR 与现金流'
    trigger: {
        type: 'CLICK' | 'LIMIT_REACHED' | 'EXPORT';
        target: string;
    };
    planToUpgrade: 'PRO' | 'ENTERPRISE';
}

/**
 * Debug 信息（用于追溯与调参）
 */
export interface OrchestratorDebug {
    signalsUsed: string[];
    rulesFired: string[];
    computedAt: string;
    cacheHit: boolean;
}

/**
 * OrchestratorResponse - 编排器核心输出
 */
export interface OrchestratorResponse {
    projectId: string;

    // 当前阶段
    stage: LifecycleStage;
    stageConfidence: number;      // 0-1，决定 UI 是否显示"你可能处于…"
    stageMeta: typeof STAGE_META[LifecycleStage];

    // 项目当前状态快照
    snapshot: ProjectSnapshot;

    // 下一步推荐动作
    recommendedActions: ActionCard[];

    // 阶段任务清单
    checklist: ChecklistItem[];

    // 付费触发点
    paywallHints: PaywallHint[];

    // 调试信息（可选）
    debug?: OrchestratorDebug;
}

/**
 * Signals - 信号聚合结果
 */
export interface Signals {
    // 项目基本信息
    hasLocation: boolean;
    hasCapacity: boolean;
    projectType?: ProjectType;

    // 资源评估
    hasSolarResource: boolean;
    hasWindResource: boolean;
    resourceRating?: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR';

    // 收益计算
    hasCalculation: boolean;
    calculationType?: ProjectType;
    calculationQuality?: QualityTag;
    lastCalculationDate?: string;
    irr?: number;
    paybackYears?: number;

    // 站址比选
    hasSiteComparison: boolean;

    // 报告
    hasReport: boolean;
    lastReportDate?: string;

    // 电站运行
    hasStation: boolean;
    hasStationRecords: boolean;
    recordCount: number;
    lastRecordDate?: string;
    totalGeneration: number;

    // 诊断
    hasDiagnosis: boolean;
    lastDiagnosisType?: string;
    lastDiagnosisSeverity?: Severity;
    lastPR?: number;

    // 论文/研究
    paperCount: number;

    // 用户活跃度
    lastActiveAt?: string;
    streakDays: number;

    // 会员信息
    userPlan: 'FREE' | 'PRO' | 'ENTERPRISE';
    dailyLimitReached: boolean;
}

/**
 * RuleContext - 规则执行上下文
 */
export interface RuleContext {
    signals: Signals;
    projectId: string;
    userId: string;
    userPlan: 'FREE' | 'PRO' | 'ENTERPRISE';
}

/**
 * Rule - 规则定义
 */
export interface Rule {
    key: string;
    name: string;
    priority: number;             // 越小越优先
    when: (ctx: RuleContext) => boolean;
    then: (ctx: RuleContext) => RuleOutput;
}

/**
 * RuleOutput - 规则输出
 */
export interface RuleOutput {
    actions?: ActionCard[];
    checklistUpdates?: Partial<ChecklistItem>[];
    paywallHints?: PaywallHint[];
    stageOverride?: LifecycleStage;
}
