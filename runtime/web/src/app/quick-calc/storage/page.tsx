'use client';

import React from 'react';
import { Factory, Zap, Battery, Car } from 'lucide-react';
import ConversationalWizard from '@/components/quick-calc/ConversationalWizard';

const STORAGE_CONFIG = {
    title: '储能收益测算',
    questions: [
        {
            id: 'type',
            botMessage: '您好！储能是解决绿电波动和降低峰值电量的关键。请问您需要哪种类型的储能方案？',
            options: [
                { id: 'industrial', label: '工商业储能', value: 'industrial', icon: Factory, hint: '削峰填谷、省电费' },
                { id: 'solar-storage', label: '光储一体', value: 'solar-storage', icon: Zap, hint: '提高绿电自发自用率' },
                { id: 'utility', label: '电网侧储能', value: 'utility', icon: Battery, hint: '独立共享电站' },
                { id: 'charging', label: '光储充一体', value: 'charging', icon: Car, hint: '充电站+储能' },
            ]
        },
        {
            id: 'capacity',
            botMessage: '明白了。您计划安装的电池容量是多少？（通常按 2 小时充放电配置）',
            inputType: 'number' as const,
            unit: 'kWh',
            placeholder: '例如 200',
            hint: '一般 100kW 功率配合 200kWh 容量'
        },
        {
            id: 'strategy',
            botMessage: '好的。您的主要目标是？（我们将根据目标匹配最佳充放电策略）',
            options: [
                { id: 'arbitrage', label: '峰谷套利', value: 'arbitrage', hint: '低吸高抛，赚取电价差' },
                { id: 'demand', label: '控制需量', value: 'demand', hint: '降低最大需量电费' },
                { id: 'backup', label: '备用电源', value: 'backup', hint: '保证重要负荷不掉电' },
            ]
        }
    ]
};

export default function StorageQuickCalc() {
    return <ConversationalWizard type="storage" config={STORAGE_CONFIG} />;
}
