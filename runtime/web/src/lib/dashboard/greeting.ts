/** 短信注册时写入的占位名，不是用户自己起的称呼。 */
const AUTO_ACCOUNT_NAME = /^用户_\d+$/;

export function isAutoAccountName(name: string | null | undefined): boolean {
    return typeof name === 'string' && AUTO_ACCOUNT_NAME.test(name.trim());
}

export function readNickname(metadata: unknown): string | null {
    if (!metadata || typeof metadata !== 'object') return null;
    const root = metadata as Record<string, unknown>;
    const bags = [root.preferences, root.profile, root].filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
    for (const bag of bags) {
        const raw = bag.nickname;
        if (typeof raw !== 'string') continue;
        const text = raw.trim().slice(0, 32);
        if (text && !isAutoAccountName(text)) return text;
    }
    return null;
}

/** 有昵称用昵称；姓名不是自动编号时用姓名；否则不带编号。 */
export function greetingFor(user: { name?: string | null; nickname?: string | null }): string {
    const nick = user.nickname?.trim();
    if (nick && !isAutoAccountName(nick)) return `你好，${nick}`;
    const name = user.name?.trim();
    if (name && !isAutoAccountName(name)) return `你好，${name}`;
    return '你好';
}

export function accountLabel(name: string | null | undefined): string {
    const trimmed = name?.trim() ?? '';
    if (!trimmed || isAutoAccountName(trimmed)) return '用户';
    return trimmed;
}
