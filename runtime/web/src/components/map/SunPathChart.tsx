'use client';

import React, { useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from 'recharts';
import { getYearSunPath } from '@/lib/api/suncalc';

interface SunPathChartProps {
    lat: number;
    lng: number;
}

export default function SunPathChart({ lat, lng }: SunPathChartProps) {
    const paths = useMemo(() => getYearSunPath(lat, lng), [lat, lng]);

    // Flatten data for simple scatter, or use multiple scatters
    // Recharts Scatter needs separate data for each line usually or type="joint"

    // We will plot 3 key dates: Summer Solstice, Equinox, Winter Solstice
    const summer = paths.find(p => p.date.includes('6/'))?.path || [];
    const equinox = paths.find(p => p.date.includes('3/'))?.path || [];
    const winter = paths.find(p => p.date.includes('12/'))?.path || [];

    return (
        <div className="h-64 w-full bg-gray-800/50 rounded-lg p-2">
            <h4 className="text-xs font-semibold text-gray-400 mb-2">太阳轨迹 (方位角 vs 高度角)</h4>
            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" dataKey="azimuth" name="方位角" unit="°" domain={[45, 315]} stroke="#9CA3AF" ticks={[90, 180, 270]} />
                    <YAxis type="number" dataKey="altitude" name="高度角" unit="°" domain={[0, 90]} stroke="#9CA3AF" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />

                    <Scatter name="夏至" data={summer} fill="#EF4444" line shape="circle" />
                    <Scatter name="春秋分" data={equinox} fill="#F59E0B" line shape="circle" />
                    <Scatter name="冬至" data={winter} fill="#3B82F6" line shape="circle" />

                </ScatterChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 text-xs mt-2">
                <span className="text-red-500">● 夏至</span>
                <span className="text-yellow-500">● 春秋分</span>
                <span className="text-blue-500">● 冬至</span>
            </div>
        </div>
    );
}
