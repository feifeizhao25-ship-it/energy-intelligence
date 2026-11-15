export const MET_DATA_LICENSE = 'pending_wecom';

export function originLabel(kind: 'sample' | 'reanalysis' | 'measured' | 'official'): string {
    if (kind === 'sample') return '示例';
    if (kind === 'reanalysis') return '再分析资料，不是测风塔或测光站实测';
    if (kind === 'measured') return '现场实测';
    return '已公布原文';
}
