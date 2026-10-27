import DiagnosticsWorkbench from '@/components/maintenance/DiagnosticsWorkbench';

export default function MaintenancePage() {
    return <div className="space-y-4 p-4">
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">勘误优先通道只给工单打标记。响应时限待人工确认，系统不自动承诺完成时间。</p>
        <DiagnosticsWorkbench />
    </div>;
}
