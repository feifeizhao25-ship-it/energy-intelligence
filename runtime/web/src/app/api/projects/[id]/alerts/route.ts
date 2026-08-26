import { NextRequest, NextResponse } from 'next/server';

// In-memory alerts storage
const alertsDb: Map<string, any[]> = new Map();

// Initialize demo alerts
alertsDb.set('demo-1', [
    {
        id: 'alert-1',
        type: 'warning',
        title: '逆变器 #03 效率偏低',
        description: '检测到 3 号逆变器在最近 2 小时内转换效率低于预期值 (-15%)，建议检查散热情况。',
        deviceId: 'station-1-3',
        deviceName: '3号逆变器组',
        createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
        status: 'active',
        priority: 'medium'
    },
    {
        id: 'alert-2',
        type: 'info',
        title: '系统自检完成',
        description: '每日例行巡检已完成，未发现重大安全隐患。',
        deviceId: null,
        deviceName: '系统',
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        status: 'resolved',
        priority: 'low'
    },
    {
        id: 'alert-3',
        type: 'success',
        title: '发电量达成日目标',
        description: '今日累计发电量已达成预设目标的 105%，超额完成。',
        deviceId: null,
        deviceName: '系统',
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
        status: 'resolved',
        priority: 'low'
    }
]);

alertsDb.set('demo-2', [
    {
        id: 'alert-4',
        type: 'error',
        title: '3号风机停机维护',
        description: '计划性维护，预计 24 小时后恢复运行。',
        deviceId: 'station-2-3',
        deviceName: '3号风机',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: 'active',
        priority: 'high'
    },
    {
        id: 'alert-5',
        type: 'warning',
        title: '风速波动较大',
        description: '过去 1 小时内风速波动范围超过 50%，建议关注变桨系统。',
        deviceId: null,
        deviceName: '风场',
        createdAt: new Date(Date.now() - 45 * 60 * 1000),
        status: 'active',
        priority: 'medium'
    }
]);

// GET - 获取项目告警列表
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const projectId = params.id;
    const url = new URL(req.url);
    const status = url.searchParams.get('status'); // 'active' | 'resolved' | 'all'

    let alerts = alertsDb.get(projectId) || [];

    if (status && status !== 'all') {
        alerts = alerts.filter(a => a.status === status);
    }

    // Sort by createdAt desc
    alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const summary = {
        total: alerts.length,
        active: alerts.filter(a => a.status === 'active').length,
        errors: alerts.filter(a => a.type === 'error' && a.status === 'active').length,
        warnings: alerts.filter(a => a.type === 'warning' && a.status === 'active').length
    };

    return NextResponse.json({
        success: true,
        data: {
            alerts,
            summary
        }
    });
}

// POST - 创建新告警 (通常由监控系统自动触发)
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const projectId = params.id;
    const body = await req.json();

    const { type, title, description, deviceId, deviceName, priority } = body;

    const newAlert = {
        id: `alert-${Date.now()}`,
        type: type || 'info',
        title,
        description,
        deviceId,
        deviceName,
        createdAt: new Date(),
        status: 'active',
        priority: priority || 'medium'
    };

    const existing = alertsDb.get(projectId) || [];
    existing.unshift(newAlert); // Add to beginning
    alertsDb.set(projectId, existing);

    return NextResponse.json({
        success: true,
        data: newAlert
    });
}

// PATCH - 更新告警状态 (确认/解决)
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const projectId = params.id;
    const body = await req.json();
    const { alertId, status } = body;

    const alerts = alertsDb.get(projectId) || [];
    const alertIndex = alerts.findIndex(a => a.id === alertId);

    if (alertIndex === -1) {
        return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    alerts[alertIndex].status = status;
    alerts[alertIndex].resolvedAt = status === 'resolved' ? new Date() : null;
    alertsDb.set(projectId, alerts);

    return NextResponse.json({
        success: true,
        data: alerts[alertIndex]
    });
}
