import { NextResponse } from 'next/server';
import * as maintenance from '@/lib/maintenance';

export async function GET() {
    try {
        const results: any = {};
        results.prAnalysis = await maintenance.analyzePR({
            lat: 38.87, lng: 115.49, capacity: 1000, actualGeneration: 99960, startDate: '20220601', endDate: '20220630'
        });
        results.cleaningDecision = await maintenance.recommendCleaning({
            lat: 38.87, lng: 115.49, capacity: 1000, lastCleaningDate: '2022-04-15'
        });
        results.inverterDiagnosis = await maintenance.diagnoseInverter({
            brand: '华为', errorCode: '2001', symptoms: 'PV1 组串反接报警'
        });
        results.stringAnalysis = await maintenance.analyzeStrings({
            invName: 'INV-01',
            strings: [{ id: 'PV1', voltage: 620, current: 10.2, power: 6324 }, { id: 'PV5', voltage: 608, current: 7.2, power: 4378 }]
        });
        results.ivAnalysis = await maintenance.analyzeIVCurve({
            voc_nom: 49.65, isc_nom: 13.92, vmp_nom: 41.80, imp_nom: 12.92, pmax_nom: 540,
            voc_meas: 48.2, isc_meas: 13.1, vmp_meas: 40.5, imp_meas: 12.3, pmax_meas: 498,
            irradiance: 980, temperature: 52
        });
        results.maintenancePlan = await maintenance.predictMaintenance({
            name: '保定 1MW 电站', commissionDate: '2022-03-15', capacity: 1000
        });
        results.workPermit = await maintenance.generateWorkPermit({
            type: 'inverter', stationName: '保定 1MW 电站', location: 'C区 3# 逆变器', planDate: '2026-06-10', staffCount: 3
        });

        return NextResponse.json({ success: true, results });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
