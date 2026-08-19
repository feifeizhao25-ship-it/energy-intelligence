// 项目时间线
// 护城河：每次操作沉淀成时间线，留存核心资产

import { prisma } from '@/lib/prisma';

/**
 * 时间线事件类型
 */
export type TimelineEventType =
    | 'PROJECT_CREATED'
    | 'LOCATION_SET'
    | 'RESOURCE_FETCHED'
    | 'CALCULATION_DONE'
    | 'DIAGNOSIS_DONE'
    | 'REPORT_GENERATED'
    | 'STATION_CREATED'
    | 'RECORD_ADDED'
    | 'MILESTONE_REACHED'
    | 'ALERT_TRIGGERED'
    | 'CONFIG_CHANGED'
    | 'EXPORT_DONE'
    | 'SHARE_CREATED'
    | 'COMMENT_ADDED'
    | 'STAGE_CHANGED'
    | 'CUSTOM'
    ;

/**
 * 时间线事件
 */
export interface TimelineEvent {
    id: string;
    projectId: string;
    userId: string;
    type: TimelineEventType;
    title: string;
    description: string;
    icon?: string;
    color?: string;
    // 事件数据
    data?: Record<string, unknown>;
    // 关联的审计ID
    auditId?: string;
    // 关联的结论卡片/诊断摘要ID
    conclusionId?: string;
    // 标签
    tags?: string[];
    // 是否里程碑
    isMilestone?: boolean;
    // 创建时间
    createdAt: string;
    // 元数据
    meta?: {
        source: string;
        version: string;
    };
}

/**
 * 时间线视图配置
 */
export interface TimelineView {
    projectId: string;
    events: TimelineEvent[];
    milestones: TimelineEvent[];
    summary: {
        totalEvents: number;
        totalCalculations: number;
        totalDiagnoses: number;
        totalReports: number;
        firstEventAt: string;
        lastEventAt: string;
        daysActive: number;
    };
    comparisons?: {
        previousPeriod: {
            period: string;
            events: number;
            calculations: number;
        };
        yearOverYear?: {
            period: string;
            events: number;
            calculations: number;
        };
    };
}

/**
 * 创建时间线事件
 */
export async function createTimelineEvent(params: {
    projectId: string;
    userId: string;
    type: TimelineEventType;
    title: string;
    description: string;
    data?: Record<string, unknown>;
    auditId?: string;
    conclusionId?: string;
    tags?: string[];
    isMilestone?: boolean;
}): Promise<TimelineEvent> {
    const now = new Date().toISOString();
    const eventId = `TL-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;

    const event: TimelineEvent = {
        id: eventId,
        projectId: params.projectId,
        userId: params.userId,
        type: params.type,
        title: params.title,
        description: params.description,
        data: params.data,
        auditId: params.auditId,
        conclusionId: params.conclusionId,
        tags: params.tags,
        isMilestone: params.isMilestone,
        createdAt: now,
        meta: {
            source: 'system',
            version: '1.0',
        },
    };

    // 持久化
    try {
        await prisma.projectTimeline.create({
            data: {
                id: eventId,
                projectId: params.projectId,
                userId: params.userId,
                type: params.type,
                title: params.title,
                description: params.description,
                data: params.data as any,
                auditId: params.auditId,
                conclusionId: params.conclusionId,
                tags: params.tags,
                isMilestone: params.isMilestone || false,
                createdAt: new Date(now),
            },
        });
    } catch (error) {
        console.warn('Timeline event write failed:', error);
    }

    return event;
}

/**
 * 获取项目时间线
 */
export async function getProjectTimeline(
    projectId: string,
    options?: {
        limit?: number;
        offset?: number;
        types?: TimelineEventType[];
        startDate?: string;
        endDate?: string;
        milestonesOnly?: boolean;
    }
): Promise<TimelineView> {
    try {
        const where: any = { projectId };

        if (options?.types?.length) {
            where.type = { in: options.types };
        }
        if (options?.startDate) {
            where.createdAt = { gte: new Date(options.startDate) };
        }
        if (options?.endDate) {
            where.createdAt = { ...where.createdAt, lte: new Date(options.endDate) };
        }
        if (options?.milestonesOnly) {
            where.isMilestone = true;
        }

        const events = await prisma.projectTimeline.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: options?.limit || 100,
            skip: options?.offset || 0,
        });

        const mapped = events.map(e => ({
            id: e.id,
            projectId: e.projectId,
            userId: e.userId,
            type: e.type as TimelineEventType,
            title: e.title,
            description: e.description,
            data: e.data as Record<string, unknown>,
            auditId: e.auditId || undefined,
            conclusionId: e.conclusionId || undefined,
            tags: e.tags || undefined,
            isMilestone: e.isMilestone,
            createdAt: e.createdAt.toISOString(),
        }));

        const milestones = mapped.filter(e => e.isMilestone);

        // 计算摘要
        const allEvents = await prisma.projectTimeline.findMany({
            where: { projectId },
            orderBy: { createdAt: 'asc' },
        });

        const summary = {
            totalEvents: allEvents.length,
            totalCalculations: allEvents.filter(e => e.type === 'CALCULATION_DONE').length,
            totalDiagnoses: allEvents.filter(e => e.type === 'DIAGNOSIS_DONE').length,
            totalReports: allEvents.filter(e => e.type === 'REPORT_GENERATED').length,
            firstEventAt: allEvents[0]?.createdAt.toISOString() || '',
            lastEventAt: allEvents[allEvents.length - 1]?.createdAt.toISOString() || '',
            daysActive: allEvents.length > 0
                ? Math.ceil((Date.now() - allEvents[0].createdAt.getTime()) / (24 * 3600 * 1000))
                : 0,
        };

        return {
            projectId,
            events: mapped,
            milestones,
            summary,
        };
    } catch (error) {
        console.error('Failed to get project timeline:', error);
        return {
            projectId,
            events: [],
            milestones: [],
            summary: {
                totalEvents: 0,
                totalCalculations: 0,
                totalDiagnoses: 0,
                totalReports: 0,
                firstEventAt: '',
                lastEventAt: '',
                daysActive: 0,
            },
        };
    }
}

/**
 * 快捷方法：记录计算完成事件
 */
export async function recordCalculationEvent(
    projectId: string,
    userId: string,
    calcType: 'SOLAR' | 'WIND' | 'STORAGE' | 'HYBRID',
    result: {
        irr?: number;
        paybackYears?: number;
        totalRevenue?: number;
    },
    auditId: string
): Promise<TimelineEvent> {
    const typeNames = { SOLAR: '光伏', WIND: '风电', STORAGE: '储能', HYBRID: '风光储' };

    return createTimelineEvent({
        projectId,
        userId,
        type: 'CALCULATION_DONE',
        title: `${typeNames[calcType]}收益测算完成`,
        description: result.irr
            ? `IRR ${(result.irr * 100).toFixed(2)}%, 回收期 ${result.paybackYears?.toFixed(1)}年`
            : '已完成收益测算',
        data: result,
        auditId,
        tags: [calcType.toLowerCase()],
        isMilestone: true,
    });
}

/**
 * 快捷方法：记录诊断完成事件
 */
export async function recordDiagnosisEvent(
    projectId: string,
    userId: string,
    diagType: string,
    result: {
        status: string;
        headline: string;
    },
    auditId: string
): Promise<TimelineEvent> {
    return createTimelineEvent({
        projectId,
        userId,
        type: 'DIAGNOSIS_DONE',
        title: `${diagType}诊断完成`,
        description: result.headline,
        data: result,
        auditId,
        tags: [diagType.toLowerCase()],
        isMilestone: result.status === 'CRITICAL' || result.status === 'ABNORMAL',
    });
}

/**
 * 快捷方法：记录阶段变更
 */
export async function recordStageChange(
    projectId: string,
    userId: string,
    fromStage: string,
    toStage: string
): Promise<TimelineEvent> {
    return createTimelineEvent({
        projectId,
        userId,
        type: 'STAGE_CHANGED',
        title: '项目阶段变更',
        description: `从"${fromStage}"进入"${toStage}"阶段`,
        data: { fromStage, toStage },
        isMilestone: true,
    });
}
