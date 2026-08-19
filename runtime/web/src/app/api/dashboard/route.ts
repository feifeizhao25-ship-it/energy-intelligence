import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

/**
 * 个人数据仪表板 API
 * 汇总用户的所有活动、统计和成就
 */

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    // 模拟用户数据汇总
    const dashboard = {
        userId,
        lastLogin: new Date().toISOString(),

        // 项目统计
        projects: {
            total: 4,
            active: 3,
            completed: 1,
            totalCapacity: 57120, // kW
            types: {
                solar: 2,
                wind: 1,
                storage: 1
            },
            recentActivity: [
                { action: '创建项目', project: '测试新电站', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
                { action: 'AI诊断', project: '北京朝阳分布式光伏示范站', timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
                { action: '查看详情', project: '内蒙古辉腾锡勒风电场 III 期', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
            ]
        },

        // 计算记录
        calculations: {
            total: 15,
            thisMonth: 8,
            byType: {
                solar: 9,
                wind: 4,
                storage: 2
            },
            savedResults: 12,
            recentCalculations: [
                { type: 'solar', capacity: 500, location: '北京', date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
                { type: 'wind', capacity: 2000, location: '内蒙古', date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() }
            ]
        },

        // 文献活动
        papers: {
            saved: 23,
            read: 15,
            collections: 3,
            recentReads: [
                { title: 'Machine Learning for Solar Energy Prediction', readAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() },
                { title: 'Deep Learning in Renewable Energy', readAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() }
            ],
            topTopics: ['Machine Learning', 'Solar Energy', 'Wind Power', 'Optimization']
        },

        // AI 助手使用
        aiUsage: {
            totalQueries: 45,
            thisWeek: 12,
            byFeature: {
                diagnosis: 15,
                assistant: 20,
                researchHelper: 10
            },
            tokenUsage: 125000,
            averageResponseTime: 2.3 // seconds
        },

        // 成就和里程碑
        achievements: {
            unlocked: [
                { id: 'first_project', name: '首个项目', description: '创建第一个电站项目', unlockedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
                { id: 'ai_expert', name: 'AI 专家', description: '使用 AI 诊断 10 次', unlockedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
                { id: 'researcher', name: '研究者', description: '保存 20 篇文献', unlockedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() }
            ],
            progress: [
                { id: 'power_user', name: '高级用户', description: '完成 50 次计算', current: 15, target: 50 },
                { id: 'community_leader', name: '社区领袖', description: '获得 100 点赞', current: 23, target: 100 }
            ]
        },

        // 使用趋势
        trends: {
            dailyActivity: Array.from({ length: 7 }, (_, i) => ({
                date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                actions: Math.floor(Math.random() * 20 + 5)
            })),
            featureUsage: [
                { feature: 'Projects', percentage: 35 },
                { feature: 'Calculator', percentage: 28 },
                { feature: 'Papers', percentage: 22 },
                { feature: 'AI Assistant', percentage: 15 }
            ]
        },

        // 推荐
        recommendations: [
            { type: 'feature', title: '试试设备监控功能', description: '查看项目下设备的实时状态', link: '/projects/demo-1/om' },
            { type: 'paper', title: '推荐阅读：最新光伏技术', description: '基于您的兴趣推荐', link: '/papers' },
            { type: 'action', title: '完成本周的性能分析', description: '已经一周未查看性能报告', link: '/projects/demo-1' }
        ],

        // 系统通知
        notifications: {
            unread: 3,
            recent: [
                { type: 'alert', title: '设备告警', message: '逆变器 #3 效率偏低', timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), read: false },
                { type: 'update', title: '系统更新', message: '新增批量操作功能', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), read: false },
                { type: 'achievement', title: '新成就解锁', message: '恭喜获得"研究者"徽章', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), read: true }
            ]
        }
    };

    return NextResponse.json({
        success: true,
        data: dashboard
    });
}
