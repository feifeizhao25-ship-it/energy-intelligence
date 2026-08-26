'use client';

import React from 'react';
import { Home, Factory, Sprout, ParkingCircle } from 'lucide-react';
import ConversationalWizard from '@/components/quick-calc/ConversationalWizard';

const SOLAR_CONFIG = {
    title: '光伏收益测算',
    questions: [
        {
            id: 'type',
            botMessage: '你好！我是您的能源分析助手。首先，请告诉我您想在哪里安装光伏系统？',
            options: [
                { id: 'home', label: '自家屋顶', value: 'home', icon: Home, hint: '别墅、自建房' },
                { id: 'commercial', label: '工厂屋顶', value: 'commercial', icon: Factory, hint: '厂房、仓库' },
                { id: 'ground', label: '农村空地', value: 'ground', icon: Sprout, hint: '空地、大棚' },
                { id: 'carport', label: '停车场', value: 'carport', icon: ParkingCircle, hint: '车棚一体化' },
            ]
        },
        {
            id: 'area',
            botMessage: '好的！那么您的可用面积大概有多大？',
            inputType: 'number' as const,
            unit: '㎡',
            placeholder: '例如 100',
            hint: '不知道？一般3间房约为 100㎡'
        },
        {
            id: 'mode',
            botMessage: '最后一个问题：您发的电打算怎么用？',
            options: [
                { id: 'self-use', label: '自己用 + 卖电', value: 'self-use', hint: '自发自用，余电上网（推荐）' },
                { id: 'full-grid', label: '全部卖给电网', value: 'full-grid', hint: '全额上网模式' },
            ]
        }
    ]
};

export default function SolarQuickCalc() {
    return <ConversationalWizard type="solar" config={SOLAR_CONFIG} />;
}
