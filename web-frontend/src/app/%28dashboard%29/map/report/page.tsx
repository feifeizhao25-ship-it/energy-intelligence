import { Metadata } from 'next';
import ReportPage from '@/components/map/ReportPage';

export const metadata: Metadata = {
    title: '资源评估报告 | 新能源智库',
    description: '生成专业的新能源资源评估报告',
};

export default function Page() {
    return <ReportPage />;
}
