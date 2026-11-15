/** 地图审图号。未配置时明确写出，不编造编号。 */
export function MapApprovalNotice() {
    const approval = process.env.NEXT_PUBLIC_MAP_APPROVAL_NO?.trim();
    return (
        <p data-testid="map-approval" className="pointer-events-none absolute bottom-3 right-3 z-10 rounded bg-white/95 px-2 py-1 text-xs font-bold text-slate-800">
            {approval ? `审图号 ${approval}` : '审图号未配置'}
        </p>
    );
}
