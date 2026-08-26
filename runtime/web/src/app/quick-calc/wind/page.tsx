'use client';

import React from 'react';
import { Home, Factory, Mountain } from 'lucide-react';
import ConversationalWizard from '@/components/quick-calc/ConversationalWizard';

const WIND_CONFIG = {
    title: '分布式风电测算',
    questions: [
        {
            id: 'type',
            botMessage: '您好！由于国家“千乡万村驭风行动”的推进，分布式风电正成为新宠。请问您计划开发哪类风电项目？',
            options: [
                { id: 'village', label: '乡村集体开发', value: 'village', icon: Home, hint: '村企合作、分红模式' },
                { id: 'industrial', label: '工业园区', value: 'industrial', icon: Factory, hint: '自发自用、节能降碳' },
                { id: 'mountain', label: '陆上集中式', value: 'mountain', icon: Mountain, hint: '集中式开发' },
            ]
        },
        {
            id: 'capacity',
            botMessage: '明白。预计的装机容量是多少？（通常单台风机在 3MW-6MW 之间）',
            inputType: 'number' as const,
            unit: 'MW',
            placeholder: '例如 5',
            hint: '1MW 约可满足 500 户家庭年用电需求'
        },
        {
            id: 'partnership',
            botMessage: '您倾向于哪种收益分配模式？',
            options: [
                { id: 'lease', label: '土地租赁', value: 'lease', hint: '固定租金收入' },
                { id: 'shares', label: '入股分红', value: 'shares', hint: '按发电收益分成' },
                { id: 'self', label: '自主投资', value: 'self', hint: '全额投资获利' },
            ]
        }
    ]
};

export default function WindQuickCalc() {
    return <ConversationalWizard type="wind" config={WIND_CONFIG} />;
}
