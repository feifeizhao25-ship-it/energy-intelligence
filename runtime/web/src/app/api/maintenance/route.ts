// 运维诊断API
import { NextRequest, NextResponse } from 'next/server';
import { executeTool } from '@/lib/ai/tool-executor';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { requireAiQuota } from '@/lib/ai/quota-guard';
import { acquireMember } from '@/lib/membership/middleware';
import { MAINTENANCE_FEATURE } from '@/lib/membership/maintenance-features';
import { safeErrorMessage } from '@/lib/api/safe-error';
import { aigcJson } from '@/lib/ai/aigc';

const KNOWN_ACTIONS = new Set([
    'health', 'fault', 'maintenance-window', 'inspection-plan', 'downtime-loss', 'cleaning', 'strings',
    'iv-curve', 'work-permit', 'predictive', 'el_detect', 'vibration', 'blade_drone', 'soh', 'thermal',
    'consistency', 'safety',
]);

export async function POST(request: NextRequest) {
    let refund: (() => Promise<void>) | null = null;
    try {
        const body = await request.json().catch(() => null);
        const { action, params } = body ?? {};

        if (!action || !params) {
            return NextResponse.json(
                { error: '缺少必要参数' },
                { status: 400 }
            );
        }

        if (!KNOWN_ACTIONS.has(action)) {
            return NextResponse.json({ error: '无效的诊断类型' }, { status: 400 });
        }

        // 原来只校验登录：免费版（运维诊断额度为 0）和专业版也能无限次调用全部运维诊断，
        // 会员页上「运维版」「每日诊断次数」都不生效，且这些诊断都会调用模型、消耗站点额度。
        // 现在：具名的运维功能要求对应会员档，所有动作都按「每日诊断次数」扣减，失败退还。
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });
        const acquired = await acquireMember({ feature: MAINTENANCE_FEATURE[action], usageType: 'diagnosis' });
        if (!acquired.ok) return acquired.response;
        refund = acquired.refund;
        if (action === 'fault') {
            const guard = await requireAiQuota();
            if (!guard.ok) { await acquired.refund(); return guard.response; }
        }

        const startTime = Date.now();
        let result;

        switch (action) {
            case 'health':
                result = await executeTool('diagnose_system_health', params);
                break;
            case 'fault':
                // User requested strongest model for precise analysis
                result = await executeTool('diagnose_fault', { ...params, model: 'deepseek-v3' });
                break;
            case 'maintenance-window':
                result = await executeTool('recommend_maintenance_window', params);
                break;
            case 'inspection-plan':
                result = await executeTool('generate_inspection_plan', params);
                break;
            case 'downtime-loss':
                result = await executeTool('calculate_downtime_loss', params);
                break;
            case 'cleaning':
                result = await executeTool('recommend_cleaning', params);
                break;
            case 'strings':
                result = await executeTool('analyze_strings', params);
                break;
            case 'iv-curve':
                result = await executeTool('analyze_iv_curve', params);
                break;
            case 'work-permit':
                result = await executeTool('generate_work_permit', params);
                break;
            case 'predictive':
                result = await executeTool('predict_maintenance', params);
                break;
            case 'el_detect':
                result = await executeTool('detect_el_defects', params);
                break;
            case 'vibration':
                result = await executeTool('analyze_vibration', params);
                break;
            case 'blade_drone':
                result = await executeTool('analyze_blade_health', params);
                break;
            case 'soh':
                result = await executeTool('monitor_storage_soh', params);
                break;
            case 'thermal':
                result = await executeTool('monitor_storage_thermal', params);
                break;
            case 'consistency':
                result = await executeTool('analyze_storage_consistency', params);
                break;
            case 'safety':
                result = await executeTool('search_safety_regulations', params);
                break;
            default:
                return NextResponse.json(
                    { error: '无效的诊断类型' },
                    { status: 400 }
                );
        }

        return aigcJson({
            success: true,
            data: result,
            action,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime
        });
    } catch (error) {
        await refund?.();
        console.error('运维诊断错误:', error);
        return NextResponse.json(
            { error: safeErrorMessage(error, '诊断失败') },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json({
        message: '运维诊断API',
        endpoints: {
            health: '系统健康诊断',
            fault: '故障诊断',
            'maintenance-window': '检修窗口推荐',
            'inspection-plan': '巡检计划生成',
            'downtime-loss': '停机损失计算'
        },
        method: 'POST',
        example: {
            action: 'health',
            params: {
                lat: 39.9,
                lng: 116.4,
                capacity: 100,
                actualGeneration: 8000,
                month: 6,
                year: 2025
            }
        }
    });
}
