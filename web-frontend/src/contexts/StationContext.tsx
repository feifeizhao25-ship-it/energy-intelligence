'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Types
export interface Station {
    id: string;
    name: string;
    type: 'solar' | 'wind' | 'storage';
    capacity: number;
    status: 'healthy' | 'warning' | 'error' | 'offline';
    location: string;
    installDate: string;
    lastCheck: string;
    efficiency: number;
    uptime: number;
    dailyGeneration: number;
    deviceCount: number;
}

export interface Issue {
    id: string;
    stationId: string;
    severity: 'error' | 'warning' | 'info';
    title: string;
    description: string;
    suggestion: string;
    estimatedLoss: string;
    solved: boolean;
    createdAt: string;
}

export interface MaintenanceRecord {
    id: string;
    stationId: string;
    type: 'inspection' | 'repair' | 'cleaning' | 'replacement';
    title: string;
    date: string;
    technician: string;
    cost: number;
    status: 'completed' | 'in_progress' | 'scheduled';
}

interface StationContextType {
    stations: Station[];
    issues: Issue[];
    records: MaintenanceRecord[];
    addStation: (station: Omit<Station, 'id'>) => string;
    dismissIssue: (id: string) => void;
    resolveIssue: (id: string) => void;
    addIssue: (issue: Omit<Issue, 'id' | 'createdAt' | 'solved'>) => void;
    getStationIssues: (stationId: string) => Issue[];
    getStationRecords: (stationId: string) => MaintenanceRecord[];
}

const StationContext = createContext<StationContextType | undefined>(undefined);

// Initial Mock Data
const INITIAL_STATIONS: Station[] = [
    {
        id: '1',
        name: '保定市区屋顶光伏电站',
        type: 'solar',
        capacity: 15,
        status: 'healthy',
        location: '河北省保定市',
        installDate: '2023-06-15',
        lastCheck: '2024-01-19 10:30',
        efficiency: 94.5,
        uptime: 99.2,
        dailyGeneration: 62.5,
        deviceCount: 42
    },
    {
        id: '2',
        name: '工厂屋顶储能系统',
        type: 'storage',
        capacity: 100,
        status: 'warning',
        location: '河北省保定市',
        installDate: '2023-08-20',
        lastCheck: '2024-01-19 09:15',
        efficiency: 89.3,
        uptime: 97.8,
        dailyGeneration: 0,
        deviceCount: 16
    },
    {
        id: '3',
        name: '农村分布式风电场',
        type: 'wind',
        capacity: 50,
        status: 'error',
        location: '河北省张家口市',
        installDate: '2023-03-10',
        lastCheck: '2024-01-19 08:45',
        efficiency: 78.5,
        uptime: 92.5,
        dailyGeneration: 285.6,
        deviceCount: 5
    }
];

const INITIAL_ISSUES: Issue[] = [
    {
        id: '1',
        stationId: '2',
        severity: 'warning',
        title: '电池效率轻微下降',
        description: '充电效率从98%降至94%，建议检查充放电策略',
        suggestion: '建议进行均衡充电，可恢复至97%以上',
        estimatedLoss: '¥320/月',
        solved: false,
        createdAt: '2024-01-18 14:30'
    },
    {
        id: '2',
        stationId: '3',
        severity: 'error',
        title: '风机振动异常',
        description: '3号风机振动值超出正常范围2.3倍，可能存在机械故障',
        suggestion: '建议立即停机检查轴承和叶片状态，避免更大损失',
        estimatedLoss: '¥1,500/天',
        solved: false,
        createdAt: '2024-01-19 06:00'
    },
    {
        id: '3',
        stationId: '1',
        severity: 'info',
        title: '组件积灰预警',
        description: '组件表面灰尘积累达到15%，预计影响发电效率8%',
        suggestion: '建议本周内进行清洗，预计可恢复95%效率',
        estimatedLoss: '¥45/周',
        solved: false,
        createdAt: '2024-01-17 09:00'
    }
];

const INITIAL_RECORDS: MaintenanceRecord[] = [
    {
        id: '1',
        stationId: '1',
        type: 'cleaning',
        title: '光伏组件清洗',
        date: '2024-01-15',
        technician: '张建国',
        cost: 800,
        status: 'completed'
    },
    {
        id: '2',
        stationId: '3',
        type: 'inspection',
        title: '月度巡检',
        date: '2024-01-20',
        technician: '李志强',
        cost: 500,
        status: 'scheduled'
    },
    {
        id: '3',
        stationId: '2',
        type: 'repair',
        title: 'BMS通信模块更换',
        date: '2024-01-10',
        technician: '王伟',
        cost: 3500,
        status: 'completed'
    }
];

export function StationProvider({ children }: { children: React.ReactNode }) {
    const [stations, setStations] = useState<Station[]>(INITIAL_STATIONS);
    const [issues, setIssues] = useState<Issue[]>(INITIAL_ISSUES);
    const [records, setRecords] = useState<MaintenanceRecord[]>(INITIAL_RECORDS);

    // Load from localStorage on mount
    useEffect(() => {
        const savedStations = localStorage.getItem('stations');
        const savedIssues = localStorage.getItem('issues');
        const savedRecords = localStorage.getItem('records');

        if (savedStations) setStations(JSON.parse(savedStations));
        if (savedIssues) setIssues(JSON.parse(savedIssues));
        if (savedRecords) setRecords(JSON.parse(savedRecords));
    }, []);

    // Save to localStorage on change
    useEffect(() => {
        localStorage.setItem('stations', JSON.stringify(stations));
        localStorage.setItem('issues', JSON.stringify(issues));
        localStorage.setItem('records', JSON.stringify(records));
    }, [stations, issues, records]);

    const addStation = (stationData: Omit<Station, 'id'>) => {
        const newStation: Station = {
            ...stationData,
            id: uuidv4(),
        };
        setStations(prev => [...prev, newStation]);
        return newStation.id;
    };

    const dismissIssue = (id: string) => {
        setIssues(prev => prev.filter(issue => issue.id !== id));
    };

    const resolveIssue = (id: string) => {
        setIssues(prev => prev.map(issue =>
            issue.id === id ? { ...issue, solved: true } : issue
        ));
    };

    const addIssue = (issueData: Omit<Issue, 'id' | 'createdAt' | 'solved'>) => {
        const newIssue: Issue = {
            ...issueData,
            id: uuidv4(),
            createdAt: new Date().toISOString(),
            solved: false,
        };
        setIssues(prev => [newIssue, ...prev]);
    };

    const getStationIssues = (stationId: string) => {
        return issues.filter(i => i.stationId === stationId);
    };

    const getStationRecords = (stationId: string) => {
        return records.filter(r => r.stationId === stationId);
    };

    return (
        <StationContext.Provider value={{
            stations,
            issues,
            records,
            addStation,
            dismissIssue,
            resolveIssue,
            addIssue,
            getStationIssues,
            getStationRecords
        }}>
            {children}
        </StationContext.Provider>
    );
}

export function useStation() {
    const context = useContext(StationContext);
    if (context === undefined) {
        throw new Error('useStation must be used within a StationProvider');
    }
    return context;
}
