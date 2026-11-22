const GB31155_LABEL: Record<string, string> = { I: '最丰富', II: '很丰富', III: '丰富', IV: '一般' };

/** 页面上显示的太阳能资源等级名称（GB/T 31155-2014 四档），例如「很丰富（GB/T 31155）」。 */
export function solarResourceLabel(resourceClass: string): string {
    const name = GB31155_LABEL[resourceClass];
    return name ? `${name}（GB/T 31155）` : `${resourceClass}类资源区`;
}
