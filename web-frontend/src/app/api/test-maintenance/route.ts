import { NextResponse } from 'next/server';
import * as maintenance from '@/lib/maintenance';

export async function GET() {
    try {
        const results: any = {};

        console.log('开始自动化运维诊断功能测试...');

        // 1. 测试 PR 分析
        console.log('正在测试 PR 分析...');
        results.prAnalysis = await maintenance.analyzePR({
            lat: 38.87,
            lng: 115.49,
            capacity: 1000,
            actualGeneration: 99960,
            startDate: '20220601',
            endDate: '20220630'
        });

        // 2. 测试清洗决策
        console.log('正在测试清洗决策...');
        results.cleaningDecision = await maintenance.recommendCleaning({
            lat: 38.87,
            lng: 115.49,
            capacity: 1000,
            lastCleaningDate: '2022-04-15'
        });

        // 3. 测试逆变器诊断
        console.log('正在测试逆变器诊断...');
        results.inverterDiagnosis = await maintenance.diagnoseInverter({
            brand: '华为',
            errorCode: '2001',
            symptoms: 'PV1 组串反接报警'
        });

        // 4. 测试组串分析
        console.log('正在测试组串分析...');
        results.stringAnalysis = await maintenance.analyzeStrings({
            invName: 'INV-01',
            strings: [
                { id: 'PV1', voltage: 620, current: 10.2, power: 6324 },
                { id: 'PV2', voltage: 618, current: 10.1, power: 6242 },
                { id: 'PV5', voltage: 608, current: 7.2, power: 4378 }
            ]
        });

        // 5. 测试 IV 曲线分析
        console.log('正在测试 IV 曲线分析...');
        results.ivAnalysis = await maintenance.analyzeIVCurve({
            voc_nom: 49.65, isc_nom: 13.92, vmp_nom: 41.80, imp_nom: 12.92, pmax_nom: 540,
            voc_meas: 48.2, isc_meas: 13.1, vmp_meas: 40.5, imp_meas: 12.3, pmax_meas: 498,
            irradiance: 980,
            temperature: 52
        });

        // 6. 测试维护预测
        console.log('正在测试维护预测...');
        results.maintenancePlan = await maintenance.predictMaintenance({
            name: '保定 1MW 电站',
            commissionDate: '2022-03-15',
            capacity: 1000
        });

        // 7. 测试工作票生成
        console.log('正在测试工作票生成...');
        results.workPermit = await maintenance.generateWorkPermit({
            type: 'inverter',
            stationName: '保定 1MW 电站',
            location: 'C区 3# 逆变器',
            planDate: '2026-06-10',
            staffCount: 3
        });

        console.log('所有运维诊断功能测试完成！');

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            results
        });

    } catch (error: any) {
        console.error('测试过程中出现错误:', error);
        return NextResponse.json({
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
