// 企业版权限与审计
// 护城河：组织级权限管理、审批流程、合规审计

/**
 * 用户角色
 */
export type UserRole =
    | 'VIEWER'        // 查看者：只能查看
    | 'OPERATOR'      // 操作员：可操作但不能配置
    | 'ANALYST'       // 分析师：可进行分析和诊断
    | 'ENGINEER'      // 工程师：可生成工单和报告
    | 'MANAGER'       // 经理：可管理项目和人员
    | 'ADMIN'         // 管理员：全权限
    | 'OWNER'         // 所有者：组织拥有者
    ;

/**
 * 权限定义
 */
export const PERMISSIONS: Record<string, string[]> = {
    VIEWER: [
        'project:view',
        'calculation:view',
        'diagnosis:view',
        'report:view',
    ],
    OPERATOR: [
        'project:view',
        'calculation:view',
        'calculation:create',
        'diagnosis:view',
        'diagnosis:create',
        'station:view',
        'station:record',
        'report:view',
    ],
    ANALYST: [
        'project:view',
        'project:edit',
        'calculation:view',
        'calculation:create',
        'calculation:export',
        'diagnosis:view',
        'diagnosis:create',
        'diagnosis:export',
        'station:view',
        'station:record',
        'report:view',
        'report:generate',
        'paper:view',
        'paper:search',
    ],
    ENGINEER: [
        'project:view',
        'project:edit',
        'project:create',
        'calculation:*',
        'diagnosis:*',
        'station:*',
        'report:*',
        'paper:*',
        'maintenance:view',
        'maintenance:create',
        'maintenance:write',
        'workorder:create',
    ],
    MANAGER: [
        'project:*',
        'calculation:*',
        'diagnosis:*',
        'station:*',
        'report:*',
        'paper:*',
        'maintenance:*',
        'workorder:*',
        'team:view',
        'team:invite',
        'team:remove',
        'audit:view',
    ],
    ADMIN: [
        '*',
        'settings:*',
        'api:*',
        'billing:view',
    ],
    OWNER: [
        '*',
        'org:*',
        'billing:*',
        'subscription:*',
    ],
};

/**
 * 组织设置
 */
export interface OrgSettings {
    id: string;
    name: string;
    plan: 'FREE' | 'PRO' | 'ENTERPRISE';
    // 是否启用审批流
    approvalFlowEnabled: boolean;
    // 是否启用双人确认
    dualConfirmRequired: boolean;
    // 敏感操作需要审批
    sensitiveOpsApproval: boolean;
    // 数据导出需要审批
    exportApprovalRequired: boolean;
    // 审计日志保留天数
    auditRetentionDays: number;
    // IP白名单
    ipWhitelist?: string[];
    // SSO配置
    ssoEnabled?: boolean;
    // 水印设置
    watermarkEnabled: boolean;
    // 自定义角色
    customRoles?: Record<string, string[]>;
}

/**
 * 审批请求
 */
export interface ApprovalRequest {
    id: string;
    orgId: string;
    requesterId: string;
    requesterName: string;
    type: 'EXPORT' | 'WORKORDER' | 'CONFIG_CHANGE' | 'ROLE_CHANGE' | 'DATA_DELETE' | 'SENSITIVE_OP';
    title: string;
    description: string;
    data: Record<string, unknown>;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
    approverIds: string[];
    approvedBy?: string[];
    rejectedBy?: string;
    rejectionReason?: string;
    createdAt: string;
    expiresAt: string;
    completedAt?: string;
}

/**
 * 合规审计事件
 */
export interface ComplianceEvent {
    id: string;
    orgId: string;
    userId: string;
    userName: string;
    action: string;
    resource: string;
    resourceId: string;
    result: 'SUCCESS' | 'DENIED' | 'ERROR';
    denyReason?: string;
    ipAddress: string;
    userAgent: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * 检查权限
 */
export function hasPermission(
    userRole: UserRole,
    requiredPermission: string,
    customPermissions?: string[]
): boolean {
    const rolePermissions = PERMISSIONS[userRole] || [];
    const allPermissions = [...rolePermissions, ...(customPermissions || [])];

    // 通配符检查
    if (allPermissions.includes('*')) return true;

    // 精确匹配
    if (allPermissions.includes(requiredPermission)) return true;

    // 分类通配符（如 project:*）
    const [category] = requiredPermission.split(':');
    if (allPermissions.includes(`${category}:*`)) return true;

    return false;
}

/**
 * 判断操作是否需要审批
 */
export function requiresApproval(
    operationType: string,
    orgSettings: OrgSettings
): boolean {
    if (!orgSettings.approvalFlowEnabled) return false;

    const sensitiveOps = [
        'delete_project',
        'batch_delete',
        'change_permissions',
        'export_all_data',
        'generate_api_key',
        'change_billing',
    ];

    const exportOps = [
        'export_report',
        'export_data',
        'share_external',
    ];

    if (orgSettings.sensitiveOpsApproval && sensitiveOps.includes(operationType)) {
        return true;
    }

    if (orgSettings.exportApprovalRequired && exportOps.includes(operationType)) {
        return true;
    }

    return false;
}

/**
 * 创建审批请求
 */
export function createApprovalRequest(params: {
    orgId: string;
    requesterId: string;
    requesterName: string;
    type: ApprovalRequest['type'];
    title: string;
    description: string;
    data: Record<string, unknown>;
    approverIds: string[];
    expiresInHours?: number;
}): ApprovalRequest {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (params.expiresInHours || 24) * 3600000);

    return {
        id: `APR-${Date.now().toString(36)}`,
        orgId: params.orgId,
        requesterId: params.requesterId,
        requesterName: params.requesterName,
        type: params.type,
        title: params.title,
        description: params.description,
        data: params.data,
        status: 'PENDING',
        approverIds: params.approverIds,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
    };
}

/**
 * 记录合规审计事件
 */
export function createComplianceEvent(params: {
    orgId: string;
    userId: string;
    userName: string;
    action: string;
    resource: string;
    resourceId: string;
    result: ComplianceEvent['result'];
    denyReason?: string;
    ipAddress: string;
    userAgent: string;
    metadata?: Record<string, unknown>;
}): ComplianceEvent {
    // 自动判断风险级别
    const highRiskActions = ['delete', 'export_all', 'permission_change', 'api_key'];
    const mediumRiskActions = ['edit', 'create', 'export'];

    let riskLevel: ComplianceEvent['riskLevel'] = 'LOW';
    if (highRiskActions.some(a => params.action.includes(a))) {
        riskLevel = params.result === 'SUCCESS' ? 'HIGH' : 'CRITICAL';
    } else if (mediumRiskActions.some(a => params.action.includes(a))) {
        riskLevel = 'MEDIUM';
    }

    return {
        id: `CE-${Date.now().toString(36)}`,
        orgId: params.orgId,
        userId: params.userId,
        userName: params.userName,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        result: params.result,
        denyReason: params.denyReason,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        timestamp: new Date().toISOString(),
        metadata: params.metadata,
        riskLevel,
    };
}

/**
 * 获取角色层级
 */
export function getRoleHierarchy(role: UserRole): number {
    const hierarchy: Record<UserRole, number> = {
        VIEWER: 1,
        OPERATOR: 2,
        ANALYST: 3,
        ENGINEER: 4,
        MANAGER: 5,
        ADMIN: 6,
        OWNER: 7,
    };
    return hierarchy[role] || 0;
}

/**
 * 检查是否可以修改目标用户角色
 */
export function canModifyUserRole(
    actorRole: UserRole,
    targetCurrentRole: UserRole,
    targetNewRole: UserRole
): boolean {
    const actorLevel = getRoleHierarchy(actorRole);
    const currentLevel = getRoleHierarchy(targetCurrentRole);
    const newLevel = getRoleHierarchy(targetNewRole);

    // 只能修改比自己低的角色
    // 只能将其设置为比自己低的角色
    return actorLevel > currentLevel && actorLevel > newLevel;
}
