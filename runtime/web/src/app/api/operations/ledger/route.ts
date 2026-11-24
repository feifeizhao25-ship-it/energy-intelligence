import { NextResponse } from 'next/server';

/** Empty ledger. Demonstration plants are not invented here. */
export async function GET() {
    return NextResponse.json({
        stations: [],
        alarms: [],
        inspections: [],
        work_orders: [],
        empty: true,
        note: '这里不填演示电站。效能、告警、巡检和工单在接入授权遥测之前保持为空。',
    });
}
