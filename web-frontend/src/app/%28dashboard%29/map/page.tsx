import { Metadata } from 'next';
import dynamic from 'next/dynamic';

// 使用动态导入禁用 SSR，因为地图组件依赖浏览器环境
const ResourceMapPage = dynamic(() => import('@/components/map/ResourceMapPage'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-screen bg-slate-950">
            <div className="text-white flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <div className="text-lg font-bold">正在加载地图组件...</div>
            </div>
        </div>
    )
});

export const metadata: Metadata = {
    title: '全球新能源资源地图 | 新能源智库',
    description: '集成NASA气象数据的全球光伏风电资源查询与评估系统',
};

export default function Page() {
    return <ResourceMapPage />;
}
