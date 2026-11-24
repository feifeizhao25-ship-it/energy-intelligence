'use client';

import { useEffect, useState } from 'react';

type Ledger = {
    stations: Array<{ id: string; name?: string }>;
    alarms: unknown[];
    inspections: unknown[];
    work_orders: unknown[];
    empty?: boolean;
    note?: string;
};

export function OperationsLedger() {
    const [ledger, setLedger] = useState<Ledger | null>(null);

    useEffect(() => {
        fetch('/api/operations/ledger')
            .then((response) => response.json())
            .then((body) => setLedger(body))
            .catch(() => setLedger({ stations: [], alarms: [], inspections: [], work_orders: [], empty: true, note: '运维台账暂时读不到。' }));
    }, []);

    return (
        <section className="ei-panel space-y-3 text-sm leading-6" data-testid="operations-ledger">
            <h2 className="text-base font-semibold">电站运维台账</h2>
            <p>{ledger?.note || '正在读取台账。'}</p>
            <div className="grid gap-3 sm:grid-cols-2">
                <article className="rounded-2xl border p-3"><h3 className="font-semibold">资产</h3><p>{ledger?.stations.length ? `${ledger.stations.length} 座已登记电站` : '还没有电站资产。'}</p></article>
                <article className="rounded-2xl border p-3"><h3 className="font-semibold">效能与告警</h3><p>{ledger?.alarms.length ? `${ledger.alarms.length} 条告警` : '没有告警。未接入遥测时不显示发电量。'}</p></article>
                <article className="rounded-2xl border p-3"><h3 className="font-semibold">巡检</h3><p>{ledger?.inspections.length ? `${ledger.inspections.length} 条巡检` : '没有巡检记录。'}</p></article>
                <article className="rounded-2xl border p-3"><h3 className="font-semibold">工单</h3><p>{ledger?.work_orders.length ? `${ledger.work_orders.length} 张工单` : '没有工单。'}</p></article>
            </div>
        </section>
    );
}
