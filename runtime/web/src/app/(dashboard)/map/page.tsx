import { Metadata } from 'next';
import ResourceMapClient from '@/components/map/ResourceMapClient';

export const metadata: Metadata = {
    title: '全球新能源资源地图 | 新能源智库',
    description: '集成NASA气象数据的全球光伏风电资源查询与评估系统',
};

export default function Page() {
    return <ResourceMapClient />;
}
