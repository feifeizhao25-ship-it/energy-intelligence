'use client';

import dynamic from 'next/dynamic';

const ResourceMapPage = dynamic(() => import('./ResourceMapPage'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-screen bg-slate-950">
            <div className="text-white flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4" />
                <div className="text-lg font-bold">正在加载地图组件...</div>
            </div>
        </div>
    ),
});

export default function ResourceMapClient() {
    return <ResourceMapPage />;
}
