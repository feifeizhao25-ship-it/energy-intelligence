// 运维诊断API
import { NextRequest, NextResponse } from 'next/server';
import { executeTool } from '@/lib/ai/tool-executor';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, params } = body;

        if (!action || !params) {
            return NextResponse.json(
                { error: '缺少必要参数' },
                { status: 400 }
            );
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

        return NextResponse.json({
            success: true,
            data: result,
            action,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime
        });
    } catch (error) {
        console.error('运维诊断错误:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '诊断失败' },
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
