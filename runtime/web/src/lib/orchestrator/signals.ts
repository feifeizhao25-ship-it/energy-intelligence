// 项目生命周期编排器 - 信号聚合器
// 从 Prisma 读取项目关键记录，形成最小信号集

import { prisma } from '@/lib/prisma';
import type { Signals, ProjectType, Severity, QualityTag } from './types';

/**
 * 聚合项目信号
 * @param projectId 项目ID
 * @param userId 用户ID
 * @returns 信号集合
 */
export async function aggregateSignals(
    projectId: string,
    userId: string
): Promise<Signals> {
    // 如果是演示项目，返回模拟数据
    if (projectId === 'demo-project') {
        return {
            hasLocation: true,
            hasCapacity: true,
            projectType: 'SOLAR' as ProjectType,
            hasSolarResource: true,
            hasWindResource: false,
            resourceRating: 'GOOD',
            hasCalculation: false,
            calculationType: undefined,
            calculationQuality: undefined,
            lastCalculationDate: undefined,
            irr: undefined,
            paybackYears: undefined,
            hasSiteComparison: false,
            hasReport: false,
            lastReportDate: undefined,
            hasStation: false,
            hasStationRecords: false,
            recordCount: 0,
            lastRecordDate: undefined,
            totalGeneration: 0,
            hasDiagnosis: false,
            lastDiagnosisType: undefined,
            lastDiagnosisSeverity: undefined,
            lastPR: undefined,
            paperCount: 0,
            lastActiveAt: new Date().toISOString(),
            streakDays: 0,
            userPlan: 'FREE',
            dailyLimitReached: false,
        };
    }

    // 并行查询所有需要的数据
    const [
        project,
        user,
        calculations,
        stations,
        stationRecords,
        diagnoses,
    ] = await Promise.all([
        // 项目基本信息
        prisma.project.findUnique({
            where: { id: projectId },
            select: {
                type: true,
                capacity: true,
                lat: true,
                lng: true,
                createdAt: true,
                updatedAt: true,
            },
        }),

        // 用户信息
        prisma.user.findUnique({
            where: { id: userId },
            select: {
                plan: true,
                streakDays: true,
                lastCheckInAt: true,
                dailyCalculations: true,
            },
        }),

        // 最近计算记录
        prisma.calculation.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
                type: true,
                input: true,
                output: true,
                createdAt: true,
            },
        }),

        // 关联电站
        prisma.station.findMany({
            where: { userId, projectId },
            select: {
                id: true,
                capacity: true,
                createdAt: true,
            },
        }),

        // 电站记录（最近30天）
        prisma.stationRecord.findMany({
            where: {
                station: { userId, projectId },
                timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            },
            orderBy: { timestamp: 'desc' },
            select: {
                energy: true,
                timestamp: true,
            },
        }),

        // 诊断记录（最近30天）
        prisma.diagnosis.findMany({
            where: {
                userId,
                createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
                type: true,
                result: true,
                createdAt: true,
            },
        }),
    ]);

    // 解析计算结果
    const lastCalc = calculations[0];
    let calculationQuality: QualityTag | undefined;
    let irr: number | undefined;
    let paybackYears: number | undefined;

    if (lastCalc?.output) {
        const result = lastCalc.output as Record<string, unknown>;
        irr = result.irr as number | undefined;
        paybackYears = result.paybackYears as number | undefined;
        calculationQuality = result.qualityTag as QualityTag || 'PREVIEW';
    }

    // 解析诊断结果
    const lastDiag = diagnoses[0];
    let lastDiagnosisSeverity: Severity | undefined;
    let lastPR: number | undefined;

    if (lastDiag?.result) {
        const result = lastDiag.result as Record<string, unknown>;
        lastPR = result.pr as number | undefined;

        // 根据 PR 值判断严重程度
        if (lastPR !== undefined) {
            if (lastPR < 0.65) lastDiagnosisSeverity = 'HIGH';
            else if (lastPR < 0.75) lastDiagnosisSeverity = 'MEDIUM';
            else lastDiagnosisSeverity = 'LOW';
        }
    }

    // 计算电站统计
    const totalGeneration = stationRecords.reduce((sum: number, r: any) => sum + (r.energy || 0), 0);
    const lastRecordDate = stationRecords[0]?.timestamp?.toISOString();

    // 判断资源评级（简化版本，因为没有solarResource字段）
    let resourceRating: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR' | undefined;
    // 根据位置简单判断（这里可以后续改进）
    if (project?.lat && project?.lng) {
        // 简单的中国地区太阳能资源评级
        const lat = project.lat;
        if (lat > 35 && lat < 42) resourceRating = 'EXCELLENT'; // 西北地区
        else if (lat > 25 && lat < 35) resourceRating = 'GOOD'; // 华东华中
        else resourceRating = 'AVERAGE';
    }

    // 判断用户额度
    const dailyLimitReached = user?.plan === 'FREE' && (user.dailyCalculations || 0) >= 3;

    return {
        // 项目基本信息
        hasLocation: !!(project?.lat && project?.lng),
        hasCapacity: !!(project?.capacity && project.capacity > 0),
        projectType: project?.type as ProjectType | undefined,

        // 资源评估
        hasSolarResource: project?.type === 'SOLAR' && !!project?.lat,
        hasWindResource: project?.type === 'WIND' && !!project?.lat,
        resourceRating,

        // 收益计算
        hasCalculation: calculations.length > 0,
        calculationType: lastCalc?.type as ProjectType | undefined,
        calculationQuality,
        lastCalculationDate: lastCalc?.createdAt?.toISOString(),
        irr,
        paybackYears,

        // 站址比选
        hasSiteComparison: calculations.filter((c: any) => c.type === 'COMPARE').length > 0,

        // 报告（暂时无报告表）
        hasReport: false,
        lastReportDate: undefined,

        // 电站运行
        hasStation: stations.length > 0,
        hasStationRecords: stationRecords.length > 0,
        recordCount: stationRecords.length,
        lastRecordDate,
        totalGeneration,

        // 诊断
        hasDiagnosis: diagnoses.length > 0,
        lastDiagnosisType: lastDiag?.type,
        lastDiagnosisSeverity,
        lastPR,

        // 论文/研究（暂时无论文表）
        paperCount: 0,

        // 用户活跃度
        lastActiveAt: user?.lastCheckInAt?.toISOString(),
        streakDays: user?.streakDays || 0,

        // 会员信息
        userPlan: (user?.plan as 'FREE' | 'PRO' | 'ENTERPRISE') || 'FREE',
        dailyLimitReached,
    };
}

/**
 * 快速获取用户的项目列表信号摘要
 * 用于 Dashboard 展示多项目状态
 */
export async function aggregateUserProjectsSummary(userId: string) {
    const projects = await prisma.project.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
            id: true,
            name: true,
            type: true,
            capacity: true,
            lat: true,
            lng: true,
            location: true,
            updatedAt: true,
            _count: {
                select: {
                    diagnoses: true,
                },
            },
        },
    });

    return projects.map(p => ({
        projectId: p.id,
        name: p.name,
        type: p.type,
        capacity: p.capacity,
        hasLocation: !!(p.lat && p.lng),
        address: p.location,
        calculationCount: p._count.diagnoses,
        lastUpdated: p.updatedAt.toISOString(),
    }));
}
