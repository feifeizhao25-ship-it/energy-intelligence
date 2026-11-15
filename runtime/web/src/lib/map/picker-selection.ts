/**
 * 位置选择器里的一次打开。
 * 点选、搜索、定位和手填都只进入待确认位置；确认选择才写回。
 * 关闭（✕）和取消走同一条：丢掉待确认位置，恢复打开前已经确认的位置。
 */

export interface PickerSession<T> {
    committed: T | null;
    pending: T | null;
}

export function openPickerSession<T>(committed: T | null): PickerSession<T> {
    return { committed, pending: null };
}

export function stagePickerSelection<T>(session: PickerSession<T>, pending: T): PickerSession<T> {
    return { ...session, pending };
}

/** 没有待确认位置时不能确认，避免把打开前的位置再提交一遍。 */
export function confirmPickerSelection<T>(session: PickerSession<T>, resolved: T): { session: PickerSession<T>; applied: T } | null {
    if (!session.pending) return null;
    return { applied: resolved, session: { committed: resolved, pending: resolved } };
}

export function dismissPickerSelection<T>(session: PickerSession<T>): { session: PickerSession<T>; restored: T | null } {
    return {
        restored: session.committed,
        session: { committed: session.committed, pending: session.committed },
    };
}
