import { Metadata } from 'next';
import ResourceMapClient from '@/components/map/ResourceMapClient';
import VectorLayerPanel from '@/components/map/VectorLayerPanel';
import MapExplanation from '@/components/map/MapExplanation';
import { ProvinceBlockChart } from '@/components/map/ProvinceBlockChart';
import { PageHeader } from '@/components/ui/design-system';

export const metadata: Metadata = {
    title: '新能源资源地图 | 新能源智库',
    description: '省级离线辐照与风速样本，请求路径不访问境外气象',
};

export default function Page() {
    return <div className="flex min-w-0 flex-col gap-4">
        <div className="order-2 md:order-1">
            <MapExplanation>
                <PageHeader
                    kicker="资源"
                    title="资源地图"
                    crumbs={[{ href: '/dashboard', label: '总览' }, { href: '/map', label: '地图' }]}
                    summary="省级离线辐照与风速样本。地图请求不访问境外气象。"
                />
                <div className="overflow-hidden rounded-2xl bg-[var(--navy)] p-4 text-white"><VectorLayerPanel /></div>
            </MapExplanation>
        </div>
        <div className="order-1 min-w-0 md:order-2">
            <div className="min-w-0 overflow-hidden rounded-2xl border border-[var(--line)]"><ResourceMapClient /></div>
        </div>
        <div className="order-3 ei-panel"><ProvinceBlockChart /></div>
    </div>;
}
