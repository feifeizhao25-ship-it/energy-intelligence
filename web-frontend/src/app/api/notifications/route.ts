import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

/**
 * 通知中心 API
 * 管理系统通知、消息和公告
 */

// In-memory notification storage
const notificationsDb: Map<string, any[]> = new Map();

// Initialize demo notifications
const demoNotifications = [
    {
        id: 'notif-1',
        type: 'alert',
        category: 'system',
        title: '设备告警',
        message: '逆变器 #3 效率偏低，建议检查散热系统',
        priority: 'high',
        read: false,
        actionUrl: '/projects/demo-1/om',
        actionText: '查看详情',
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        metadata: {
            projectId: 'demo-1',
            deviceId: 'station-1-3'
        }
    },
    {
        id: 'notif-2',
        type: 'update',
        category: 'feature',
        title: '新功能上线',
        message: '批量操作功能现已可用，支持批量重启设备、批量处理告警等操作',
        priority: 'medium',
        read: false,
        actionUrl: '/projects/demo-1/om',
        actionText: '了解更多',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    },
    {
        id: 'notif-3',
        type: 'achievement',
        category: 'milestone',
        title: '新成就解锁',
        message: '恭喜！您已获得"研究者"徽章，已保存 20 篇文献',
        priority: 'low',
        read: true,
        actionUrl: '/achievements',
        actionText: '查看成就',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
        id: 'notif-4',
        type: 'maintenance',
        category: 'reminder',
        title: '维护提醒',
        message: '光伏组件清洗计划将在 3 天后执行，请提前做好准备',
        priority: 'medium',
        read: false,
        actionUrl: '/projects/demo-1/om?tab=maintenance',
        actionText: '查看计划',
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        metadata: {
            projectId: 'demo-1',
            taskId: 'maint-1',
            scheduledDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        }
    },
    {
        id: 'notif-5',
        type: 'report',
        category: 'automation',
        title: '日报已生成',
        message: '《北京朝阳分布式光伏示范站 - 每日运维报告》已自动生成',
        priority: 'low',
        read: true,
        actionUrl: '/projects/demo-1/reports',
        actionText: '查看报告',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
            projectId: 'demo-1',
            reportId: 'report-daily-001'
        }
    }
];

// GET - 获取通知列表
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || 'dev-master-id';

    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
    const category = url.searchParams.get('category');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    let notifications = notificationsDb.get(userId) || [...demoNotifications];

    // 过滤
    if (unreadOnly) {
        notifications = notifications.filter(n => !n.read);
    }
    if (category) {
        notifications = notifications.filter(n => n.category === category);
    }

    // 排序（最新的在前）
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 限制数量
    const paginatedNotifications = notifications.slice(0, limit);

    // 统计
    const stats = {
        total: notifications.length,
        unread: notifications.filter(n => !n.read).length,
        byPriority: {
            high: notifications.filter(n => n.priority === 'high').length,
            medium: notifications.filter(n => n.priority === 'medium').length,
            low: notifications.filter(n => n.priority === 'low').length
        },
        byCategory: {
            system: notifications.filter(n => n.category === 'system').length,
            feature: notifications.filter(n => n.category === 'feature').length,
            milestone: notifications.filter(n => n.category === 'milestone').length,
            reminder: notifications.filter(n => n.category === 'reminder').length,
            automation: notifications.filter(n => n.category === 'automation').length
        }
    };

    return NextResponse.json({
        success: true,
        data: {
            notifications: paginatedNotifications,
            stats,
            hasMore: notifications.length > limit
        }
    });
}

// POST - 创建新通知
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || 'dev-master-id';

    const body = await req.json();
    const { type, category, title, message, priority = 'medium', actionUrl, actionText, metadata } = body;

    const newNotification = {
        id: `notif-${Date.now()}`,
        type,
        category,
        title,
        message,
        priority,
        read: false,
        actionUrl,
        actionText,
        createdAt: new Date().toISOString(),
        metadata
    };

    const existing = notificationsDb.get(userId) || [...demoNotifications];
    existing.unshift(newNotification);
    notificationsDb.set(userId, existing);

    return NextResponse.json({
        success: true,
        data: newNotification
    });
}

// PATCH - 更新通知状态（标记为已读/未读）
export async function PATCH(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || 'dev-master-id';

    const body = await req.json();
    const { notificationIds, read, readAll } = body;

    const notifications = notificationsDb.get(userId) || [...demoNotifications];

    if (readAll) {
        // 标记所有为已读
        notifications.forEach(n => n.read = true);
    } else if (notificationIds && Array.isArray(notificationIds)) {
        // 标记指定通知
        notificationIds.forEach(id => {
            const notification = notifications.find(n => n.id === id);
            if (notification) {
                notification.read = read !== undefined ? read : true;
            }
        });
    }

    notificationsDb.set(userId, notifications);

    return NextResponse.json({
        success: true,
        data: {
            updated: notificationIds?.length || notifications.length,
            message: readAll ? '所有通知已标记为已读' : `${notificationIds?.length || 0} 条通知已更新`
        }
    });
}

// DELETE - 删除通知
export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || 'dev-master-id';

    const url = new URL(req.url);
    const notificationId = url.searchParams.get('id');
    const deleteAll = url.searchParams.get('deleteAll') === 'true';

    let notifications = notificationsDb.get(userId) || [...demoNotifications];

    if (deleteAll) {
        // 删除所有已读通知
        const unreadNotifications = notifications.filter(n => !n.read);
        notificationsDb.set(userId, unreadNotifications);
        return NextResponse.json({
            success: true,
            data: {
                deleted: notifications.length - unreadNotifications.length,
                message: '已删除所有已读通知'
            }
        });
    } else if (notificationId) {
        // 删除指定通知
        const updatedNotifications = notifications.filter(n => n.id !== notificationId);
        notificationsDb.set(userId, updatedNotifications);
        return NextResponse.json({
            success: true,
            data: {
                deleted: 1,
                message: '通知已删除'
            }
        });
    }

    return NextResponse.json({
        success: false,
        error: 'Missing notification ID or deleteAll flag'
    }, { status: 400 });
}
