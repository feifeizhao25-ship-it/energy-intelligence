import { NextResponse } from 'next/server';
import { calculateWind } from '@/lib/calculator/wind';
import { WindCalculationInput } from '@/types';

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // 验证输入
        if (!body.lat || !body.lng || !body.capacity) {
            return NextResponse.json(
                { error: '缺少必要参数 (lat, lng, capacity)' },
                { status: 400 }
            );
        }

        const input: WindCalculationInput = {
            lat: Number(body.lat),
            lng: Number(body.lng),
            projectName: body.projectName || '未命名项目',
            province: body.province || '未知',
            turbine: {
                type: body.turbineType || 'medium_wind',
                capacity: (Number(body.capacity) / (Number(body.turbineCount) || 1)) / 1000, // 单机容量 MW
                count: Number(body.turbineCount) || 1,
                hubHeight: Number(body.hubHeight) || 80,
                rotorDiameter: Number(body.rotorDiameter) || 100,
                cutInSpeed: Number(body.cutInSpeed) || 3,
                ratedSpeed: Number(body.ratedSpeed) || 12,
                cutOutSpeed: Number(body.cutOutSpeed) || 25,
            },
            businessModel: {
                mode: (body.mode as any) || 'full_export',
                feedInTariff: Number(body.electricityPrice) || 0.4,
                selfUseRatio: Number(body.selfUseRatio) || 0.8
            },
            investment: {
                unitCost: Number(body.unitCost) || 5500
            },
            operation: {
                operationYears: 20,
                availability: 0.97
            }
        };

        const result = await calculateWind(input);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Wind calculation error:', error);
        return NextResponse.json(
            { error: '计算服务出错' },
            { status: 500 }
        );
    }
}
