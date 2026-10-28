import DiagnosticsWorkbench from '@/components/maintenance/DiagnosticsWorkbench';
import { PageHeader } from '@/components/ui/design-system';

export default function MaintenancePage() {
    return <div className="mx-auto min-w-0 max-w-5xl space-y-4">
        <PageHeader
            kicker="运维"
            title="运维诊断"
            crumbs={[{ href: '/dashboard', label: '总览' }, { href: '/maintenance', label: '运维' }]}
            summary="性能比、组件曲线和故障代码只使用本页填写的数字。结果是比值或手册对照，不是维修承诺。"
        />
        <p className="ei-panel text-sm leading-6">勘误优先通道只给工单打标记。响应时限待人工确认，系统不自动承诺完成时间。</p>
        <DiagnosticsWorkbench />
    </div>;
}
