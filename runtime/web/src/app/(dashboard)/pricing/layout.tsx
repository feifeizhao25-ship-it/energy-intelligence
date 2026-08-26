import { Metadata } from 'next';

export const metadata: Metadata = {
    title: '会员定价 | 新能源智库',
    description: '选择适合您的会员方案，从免费体验到企业定制',
};

export default function PricingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
