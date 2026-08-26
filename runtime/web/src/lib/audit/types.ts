// 审计与可追溯系统 - 核心类型定义
// 护城河第一层：可解释与可审计（Auditability）

/**
 * 计算版本元数据
 * 确保每次计算都可追溯、可复现
 */
export interface CalcVersionMeta {
    // 计算引擎版本
    calcVersion: string;
    // 假设集版本（参数默认值版本）
    assumptionVersion: string;
    // 模型版本（如有AI辅助）
    modelVersion?: string;
    // 计算时间戳
    timestamp: string;
    // 计算耗时（ms）
    computeTimeMs?: number;
}

/**
 * 数据来源证据
 * 追溯每个输入数据的来源
 */
export interface DataEvidence {
    // 数据源标识
    sourceId: string;
    // 数据源名称
    sourceName: string;
    // 数据源类型
    sourceType: 'NASA_POWER' | 'NREL' | 'POLICY_DB' | 'USER_INPUT' | 'STATION_RECORD' | 'THIRD_PARTY' | 'CALCULATED';
    // 数据获取时间
    fetchedAt: string;
    // 数据有效期
    validUntil?: string;
    // 原始值（用于审计）
    rawValue?: unknown;
    // 数据版本/快照ID
    snapshotId?: string;
    // 许可证/授权信息
    license?: string;
}

/**
 * 假设参数集
 * 记录计算使用的所有假设
 */
export interface AssumptionSet {
    // 假设集ID
    id: string;
    // 假设集名称
    name: string;
    // 版本号
    version: string;
    // 适用场景
    scenario: 'CONSERVATIVE' | 'STANDARD' | 'OPTIMISTIC' | 'CUSTOM';
    // 具体假设参数
    parameters: Record<string, {
        value: number | string | boolean;
        unit?: string;
        description: string;
        source?: string;
        locked?: boolean; // 是否用户锁定
    }>;
    // 创建时间
    createdAt: string;
    // 创建者
    createdBy?: string;
}

/**
 * 口径定义
 * 新能源行业术语与计算口径标准化
 */
export interface CalibrationStandard {
    // 口径ID
    id: string;
    // 指标名称
    name: string;
    // 英文缩写
    abbr: string;
    // 定义说明
    definition: string;
    // 计算公式（LaTeX或文本）
    formula: string;
    // 单位
    unit: string;
    // 参考标准
    reference: string;
    // 行业惯例说明
    industryNote?: string;
    // 版本
    version: string;
}

/**
 * 审计记录
 * 完整的计算/诊断审计链
 */
export interface AuditRecord {
    // 审计ID
    id: string;
    // 操作类型
    type: 'CALCULATION' | 'DIAGNOSIS' | 'REPORT' | 'EXPORT' | 'AI_CALL' | 'DATA_MUTATION';
    // 项目ID
    projectId?: string;
    // 用户ID
    userId: string;
    // 组织ID（企业版）
    orgId?: string;
    // 计算版本元数据
    versionMeta: CalcVersionMeta;
    // 输入数据
    inputs: Record<string, unknown>;
    // 数据来源证据
    evidences: DataEvidence[];
    // 假设集
    assumptions: AssumptionSet;
    // 输出结果
    outputs: Record<string, unknown>;
    // 关键中间量（用于复现验证）
    intermediates?: Record<string, {
        name: string;
        value: number;
        unit: string;
        formula?: string;
    }>;
    // 引用的口径
    calibrations?: string[];
    // IP地址
    ipAddress?: string;
    // 客户端信息
    userAgent?: string;
    // 创建时间
    createdAt: string;
    // 校验哈希（防篡改）
    checksum?: string;
}

/**
 * 可审计输出包装器
 * 所有计算/诊断结果都应该包装在这个结构中
 */
export interface AuditableResult<T> {
    // 实际结果
    result: T;
    // 审计元数据
    audit: {
        // 审计记录ID（可用于查询完整审计链）
        auditId: string;
        // 计算版本
        calcVersion: string;
        // 假设集版本
        assumptionVersion: string;
        // 数据来源概要
        dataSources: string[];
        // 计算时间
        computedAt: string;
        // 可复现性哈希
        reproducibilityHash: string;
    };
    // 引用的口径
    calibrations: CalibrationStandard[];
    // 风险提示
    riskWarnings?: RiskWarning[];
    // 置信度
    confidence?: number;
    // 有效期
    validUntil?: string;
}

/**
 * 风险提示
 * 护城河：安全边界
 */
export interface RiskWarning {
    // 风险级别
    level: 'INFO' | 'WARNING' | 'CAUTION' | 'CRITICAL';
    // 风险类型
    type: 'DATA_QUALITY' | 'ASSUMPTION_SENSITIVE' | 'MARKET_RISK' | 'TECHNICAL_RISK' | 'REGULATORY_RISK' | 'OPERATIONAL_RISK';
    // 风险描述
    message: string;
    // 建议动作
    suggestedAction?: string;
    // 影响范围
    impactScope?: string;
    // 相关参数
    relatedParams?: string[];
}

/**
 * 操作风险分级
 * 护城河：涉及写入/工单/工作票需要二次确认
 */
export type OperationRiskLevel =
    | 'READ_ONLY'      // 只读，无风险
    | 'LOW_WRITE'      // 低风险写入（如保存草稿）
    | 'MEDIUM_WRITE'   // 中等风险写入（如更新配置）
    | 'HIGH_WRITE'     // 高风险写入（如工单提交）
    | 'CRITICAL_WRITE' // 关键写入（如停机操作、安全相关）
    ;

/**
 * 操作确认要求
 */
export interface OperationConfirmation {
    // 操作ID
    operationId: string;
    // 风险级别
    riskLevel: OperationRiskLevel;
    // 操作描述
    description: string;
    // 影响范围
    impactScope: string;
    // 必需的前置检查
    requiredChecks: string[];
    // 需要的确认方式
    confirmationType: 'NONE' | 'SINGLE_CLICK' | 'DOUBLE_CONFIRM' | 'PASSWORD' | 'TWO_FACTOR' | 'SUPERVISOR_APPROVAL';
    // 超时时间（秒）
    timeoutSeconds?: number;
    // 是否可撤销
    reversible: boolean;
    // 撤销时间窗口（秒）
    undoWindowSeconds?: number;
}
