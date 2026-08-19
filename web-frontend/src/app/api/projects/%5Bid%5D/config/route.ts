import { NextRequest, NextResponse } from 'next/server';

// In-memory configuration storage
const configDb: Map<string, any> = new Map();

// Default configuration
const defaultConfig = {
    general: {
        name: '',
        timezone: 'Asia/Shanghai',
        language: 'zh-CN',
        units: 'metric' // metric or imperial
    },
    monitoring: {
        refreshInterval: 30, // seconds
        dataRetention: 365, // days
        alertThreshold: {
            temperature: 70, // °C
            efficiency: 80, // %
            voltage: { min: 220, max: 240 } // V
        }
    },
    alerts: {
        emailEnabled: true,
        smsEnabled: false,
        webhookEnabled: false,
        webhookUrl: '',
        recipients: []
    },
    maintenance: {
        autoSchedule: true,
        defaultDuration: 2, // hours
        advanceNotice: 24, // hours
        workingHours: {
            start: '08:00',
            end: '18:00'
        }
    },
    performance: {
        targetEfficiency: 95, // %
        targetPR: 85, // %
        targetAvailability: 98 // %
    },
    security: {
        twoFactorAuth: false,
        sessionTimeout: 30, // minutes
        ipWhitelist: [],
        auditLog: true
    }
};

// GET - 获取配置
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const projectId = params.id;
    const config = configDb.get(projectId) || { ...defaultConfig };

    return NextResponse.json({
        success: true,
        data: config
    });
}

// PUT - 更新配置
export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const projectId = params.id;
    const body = await req.json();

    try {
        const currentConfig = configDb.get(projectId) || { ...defaultConfig };
        const updatedConfig = { ...currentConfig, ...body };

        configDb.set(projectId, updatedConfig);

        return NextResponse.json({
            success: true,
            data: updatedConfig,
            message: '配置已更新'
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message || '配置更新失败'
        }, { status: 500 });
    }
}

// POST - 重置为默认配置
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const projectId = params.id;
    configDb.set(projectId, { ...defaultConfig });

    return NextResponse.json({
        success: true,
        data: defaultConfig,
        message: '配置已重置为默认值'
    });
}
