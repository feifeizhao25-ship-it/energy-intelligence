import { NextResponse } from 'next/server';
import { calculateStorage } from '@/lib/calculator/storage';
import { StorageCalculationInput } from '@/types';

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

        const input: StorageCalculationInput = {
            capacity: Number(body.power) || Number(body.capacity) / 2, // 功率 kW
            energy: Number(body.capacity), // 容量 kWh
            batteryType: 'lithium',
            location: {
                province: body.province || '未知',
                lat: Number(body.lat),
                lng: Number(body.lng),
            },
            applicationMode: 'arbitrage',
            arbitrageConfig: {
                chargeTime1: [0, 4],
                dischargeTime1: [8, 11],
                peakPrice: 1.0,
                valleyPrice: 0.3,
                flatPrice: 0.6
            },
            investment: {
                unitCost: Number(body.unitCost) || 1200,
                financing: 'cash'
            },
            technical: {
                efficiency: 90,
                dod: 90,
                cycleLife: Number(body.cycleLife) || 6000,
                degradationRate: 2,
                maintenanceCostRatio: 0.5
            }
        };

        const result = await calculateStorage(input);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Storage calculation error:', error);
        return NextResponse.json(
            { error: '计算服务出错' },
            { status: 500 }
        );
    }
}
