import { Metadata } from 'next';
import ResourceMapClient from '@/components/map/ResourceMapClient';

export const metadata: Metadata = {
    title: '全球新能源资源地图 | 新能源智库',
    description: '基于公开气象数据的光伏风电资源查询',
};

export default function Page() {
    return <ResourceMapClient />;
}
