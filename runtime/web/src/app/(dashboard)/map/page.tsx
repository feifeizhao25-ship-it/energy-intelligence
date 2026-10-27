import { Metadata } from 'next';
import ResourceMapClient from '@/components/map/ResourceMapClient';
import VectorLayerPanel from '@/components/map/VectorLayerPanel';

export const metadata: Metadata = {
    title: '新能源资源地图 | 新能源智库',
    description: '省级离线辐照与风速样本，请求路径不访问境外气象',
};

export default function Page() {
    return <div>
        <div className="bg-slate-950 p-4"><VectorLayerPanel /></div>
        <ResourceMapClient />
    </div>;
}
