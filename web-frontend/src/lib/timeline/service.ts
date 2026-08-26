/**
 * 🏰 护城河系统：项目时间线服务 (Timeline OS)
 * 让用户的数据沉淀，随着时间推移，迁移成本无线趋向于无穷大
 */

import { prisma } from '@/lib/prisma';

export enum ProjectEventType {
    PROJECT_CREATED = 'PROJECT_CREATED',
    FEASIBILITY_COMPLETED = 'FEASIBILITY_COMPLETED',
    DIAGNOSIS_PERFORMED = 'DIAGNOSIS_PERFORMED',
    REPORT_GENERATED = 'REPORT_GENERATED',
    GENERATION_MILESTONE = 'GENERATION_MILESTONE'
}

export class TimelineService {
    /**
     * 记录项目关键事件
     */
    async recordEvent(params: {
        projectId: string;
        eventType: ProjectEventType;
        title: string;
        description?: string;
        userId: string;
        snapshotId?: string;
        importance?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
    }) {
        return prisma.projectEvent.create({
            data: {
                projectId: params.projectId,
                eventType: params.eventType as any,
                title: params.title,
                description: params.description,
                userId: params.userId,
                snapshotId: params.snapshotId,
                importance: params.importance || 'NORMAL'
            }
        });
    }

    /**
     * 获取项目时间线视图
     */
    async getTimeline(projectId: string) {
        return prisma.projectEvent.findMany({
            where: { projectId },
            orderBy: { eventDate: 'desc' },
            include: {
                snapshot: true,
                user: {
                    select: { name: true, image: true }
                }
            }
        });
    }

    /**
     * 战略级功能：预测下一步行动 (Next Best Action)
     */
    async recommendNextSteps(projectId: string) {
        const events = await prisma.projectEvent.findMany({
            where: { projectId },
            orderBy: { eventDate: 'desc' },
            take: 5
        });

        const recommendations = [];

        // 逻辑：如果刚创建项目，推荐资源评估
        if (events.length === 1 && events[0].eventType === 'PROJECT_CREATED') {
            recommendations.push({
                action: "资源评估",
                reason: "新项目需要获取准确的太阳能/风能资源数据",
                link: `/project/${projectId}/resource`
            });
        }

        // 逻辑：如果完成了可研，推荐生成正式报告
        if (events.some(e => e.eventType === 'FEASIBILITY_COMPLETED')) {
            recommendations.push({
                action: "导出PDF报告",
                reason: "可研已完成，导出正式文档用于提交审批",
                link: `/project/${projectId}/report`
            });
        }

        return recommendations;
    }
}

export const timelineService = new TimelineService();
