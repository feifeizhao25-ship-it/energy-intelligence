import { NextRequest, NextResponse } from 'next/server';

// In-memory maintenance tasks storage
const maintenanceDb: Map<string, any[]> = new Map();

// Initialize demo maintenance tasks
maintenanceDb.set('demo-1', [
    {
        id: 'maint-1',
        title: '光伏组件清洗',
        description: '对全场光伏组件进行清洗，提升发电效率',
        type: 'cleaning',
        status: 'scheduled',
        priority: 'medium',
        scheduledDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days later
        estimatedDuration: 4, // hours
        assignedTo: '运维一组',
        devices: ['所有光伏组件'],
        createdAt: new Date()
    },
    {
        id: 'maint-2',
        title: '逆变器例行检查',
        description: '对所有逆变器进行季度例行检查，包括接线端子、散热系统、防护等级',
        type: 'inspection',
        status: 'scheduled',
        priority: 'high',
        scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days later
        estimatedDuration: 8,
        assignedTo: '技术服务部',
        devices: ['1号逆变器组', '2号逆变器组', '3号逆变器组'],
        createdAt: new Date()
    },
    {
        id: 'maint-3',
        title: '3号逆变器散热检修',
        description: '针对3号逆变器温度异常问题进行专项检修',
        type: 'repair',
        status: 'in_progress',
        priority: 'urgent',
        scheduledDate: new Date(),
        estimatedDuration: 2,
        assignedTo: '技术服务部',
        devices: ['3号逆变器组'],
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        notes: '已派单，工程师在途'
    }
]);

maintenanceDb.set('demo-2', [
    {
        id: 'maint-4',
        title: '3号风机叶片检查',
        description: '计划性维护：叶片视觉检查与平衡校准',
        type: 'inspection',
        status: 'in_progress',
        priority: 'high',
        scheduledDate: new Date(),
        estimatedDuration: 24,
        assignedTo: '风机维护组',
        devices: ['3号风机'],
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        notes: '已停机，检修中'
    },
    {
        id: 'maint-5',
        title: '变桨系统润滑保养',
        description: '对全场风机变桨系统进行润滑保养',
        type: 'maintenance',
        status: 'scheduled',
        priority: 'medium',
        scheduledDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        estimatedDuration: 16,
        assignedTo: '风机维护组',
        devices: ['所有风机'],
        createdAt: new Date()
    }
]);

// GET - 获取维护任务列表
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const projectId = params.id;
    const url = new URL(req.url);
    const status = url.searchParams.get('status');

    let tasks = maintenanceDb.get(projectId) || [];

    if (status && status !== 'all') {
        tasks = tasks.filter(t => t.status === status);
    }

    // Sort by priority then scheduledDate
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    tasks.sort((a, b) => {
        const pDiff = (priorityOrder[a.priority as keyof typeof priorityOrder] || 2) -
            (priorityOrder[b.priority as keyof typeof priorityOrder] || 2);
        if (pDiff !== 0) return pDiff;
        return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
    });

    const summary = {
        total: tasks.length,
        scheduled: tasks.filter(t => t.status === 'scheduled').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        urgent: tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length
    };

    return NextResponse.json({
        success: true,
        data: {
            tasks,
            summary
        }
    });
}

// POST - 创建新维护任务
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const projectId = params.id;
    const body = await req.json();

    const { title, description, type, priority, scheduledDate, estimatedDuration, assignedTo, devices } = body;

    const newTask = {
        id: `maint-${Date.now()}`,
        title,
        description,
        type: type || 'inspection',
        status: 'scheduled',
        priority: priority || 'medium',
        scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
        estimatedDuration: estimatedDuration || 2,
        assignedTo: assignedTo || '待分配',
        devices: devices || [],
        createdAt: new Date()
    };

    const existing = maintenanceDb.get(projectId) || [];
    existing.push(newTask);
    maintenanceDb.set(projectId, existing);

    return NextResponse.json({
        success: true,
        data: newTask
    });
}

// PATCH - 更新任务状态
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const projectId = params.id;
    const body = await req.json();
    const { taskId, status, notes } = body;

    const tasks = maintenanceDb.get(projectId) || [];
    const taskIndex = tasks.findIndex(t => t.id === taskId);

    if (taskIndex === -1) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (status) tasks[taskIndex].status = status;
    if (notes) tasks[taskIndex].notes = notes;
    if (status === 'completed') {
        tasks[taskIndex].completedAt = new Date();
    }

    maintenanceDb.set(projectId, tasks);

    return NextResponse.json({
        success: true,
        data: tasks[taskIndex]
    });
}
