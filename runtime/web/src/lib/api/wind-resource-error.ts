/**
 * 国内风资源只有省级城市离线样本（匹配半径见 domestic-resources.json 的 match_degrees）。
 * 张北这类远离省会的坐标没有样本。邻近省会插值会编出风速，所以这里直接拒绝。
 */
export const WIND_RESOURCE_UNAVAILABLE_MESSAGE = '该位置暂无风资源数据';

export class WindResourceUnavailableError extends Error {
    readonly code = 'WIND_RESOURCE_UNAVAILABLE';

    constructor() {
        super(WIND_RESOURCE_UNAVAILABLE_MESSAGE);
        this.name = 'WindResourceUnavailableError';
    }
}

export function isWindResourceUnavailable(error: unknown): boolean {
    if (error instanceof WindResourceUnavailableError) return true;
    if (!(error instanceof Error)) return false;
    return error.name === 'WindResourceUnavailableError' || error.message === WIND_RESOURCE_UNAVAILABLE_MESSAGE;
}

export function windResourceUnavailableBody() {
    return {
        error: 'WIND_RESOURCE_UNAVAILABLE' as const,
        message: WIND_RESOURCE_UNAVAILABLE_MESSAGE,
    };
}
