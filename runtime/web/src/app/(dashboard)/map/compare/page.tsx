import { Metadata } from 'next';
import ComparePage from '@/components/map/ComparePage';

export const metadata: Metadata = {
    title: '多点资源对比 | 新能源智库',
    description: '对比全球多地光伏风电资源数据，辅助选址决策',
};

export default function Page() {
    return <ComparePage />;
}
