
import ResourceMapContainer from '@/components/map/ResourceMapPage';

export const metadata = {
    title: '新能源资源地图 - 新能源智库',
    description: '可视化查询中国各地光伏与风能资源分布，可用于选址初筛。',
};

export default function ResourceMapPage() {
    return (
        <div className="flex flex-col h-screen overflow-hidden">
            <ResourceMapContainer />
        </div>
    );
}
