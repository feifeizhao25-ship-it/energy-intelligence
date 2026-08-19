// 审计模块统一导出

// 核心类型
export * from './types';

// 口径库
export {
    CALIBRATIONS,
    getCalibration,
    getCalibrations,
    formatCalibrationRef,
    CALIBRATION_VERSION
} from './calibrations';

// 审计服务
export {
    CALC_VERSION,
    ASSUMPTION_VERSION,
    createAuditRecord,
    wrapAuditableResult,
    getAuditRecord,
    verifyAuditRecord,
    getProjectAuditHistory,
    assessOperationRisk,
} from './audit-service';

// 结论卡片与诊断摘要
export {
    type ConclusionCard,
    type DiagnosticSummary,
    createConclusionCard,
    createDiagnosticSummary,
    determineRecommendationLevel,
    determineDiagnosticStatus,
} from './conclusion-card';

// 项目时间线
export {
    type TimelineEvent,
    type TimelineView,
    type TimelineEventType,
    createTimelineEvent,
    getProjectTimeline,
    recordCalculationEvent,
    recordDiagnosisEvent,
    recordStageChange,
} from './timeline';

// 配额系统
export {
    type QuotaType,
    type PlanType,
    type QuotaUsage,
    QUOTA_LIMITS,
    QUOTA_RESET_PERIOD,
    getUserPlan,
    getQuotaUsage,
    checkQuota,
    consumeQuota,
    getAllQuotaUsage,
    createQuotaMiddleware,
} from './quota';

// 工具白名单
export {
    type ToolDefinition,
    TOOL_WHITELIST,
    isToolAllowed,
    getToolDefinition,
    getToolRiskLevel,
    checkToolPermission,
    sandboxExecuteTool,
    getAvailableTools,
    getToolsByCategory,
} from './tool-whitelist';

// 企业版权限
export {
    type UserRole,
    type OrgSettings,
    type ApprovalRequest,
    type ComplianceEvent,
    PERMISSIONS,
    hasPermission,
    requiresApproval,
    createApprovalRequest,
    createComplianceEvent,
    getRoleHierarchy,
    canModifyUserRole,
} from './enterprise';

// OpenClaw 集成
export {
    type OpenClawSkill,
    type OpenClawCapability,
    XINNENGYUAN_SKILL,
    handleOpenClawRequest,
} from './openclaw-skill';
