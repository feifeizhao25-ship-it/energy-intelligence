import { defaultReadingMode, parsePreferences, type PreferenceTag, type Role } from './personalization';
import { bottomLineTerms } from '@/lib/compliance/bottom-line';

export interface FollowItem {
    kind: '省份' | '主题' | '文号' | '数据集' | '项目';
    value: string;
}

export interface UserProfileDraft {
    role: Role | null;
    subRole: string | null;
    provinces: string[];
    topics: string[];
    projectStage: string | null;
    readingMode: 'beginner' | 'professional';
    notify: { frequency: string; channel: string; window: string };
    personalized: boolean;
    tags: PreferenceTag[];
    follows: FollowItem[];
    understoodTerms: string[];
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function text(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function textList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim());
}

/** 从 usage_logs.metadata 或设置页请求体还原画像。旧字段全部保留。 */
export function profileFromUsageMetadata(metadata: unknown): UserProfileDraft {
    const root = asRecord(metadata);
    const nested = asRecord(root.preferences);
    const source = Object.keys(nested).length ? nested : root;
    const prefs = parsePreferences({ preferences: source });
    const extra = asRecord(root.profile);
    const reading = extra.readingMode ?? source.readingMode;
    const provinces = textList(extra.provinces ?? source.provinces);
    const topics = textList(extra.topics ?? source.topics);
    return {
        role: prefs.role,
        subRole: text(extra.subRole ?? source.subRole),
        provinces: provinces.length ? provinces : (prefs.province ? [prefs.province] : []),
        topics: topics.length ? topics : (prefs.interest ? [prefs.interest] : []),
        projectStage: text(extra.projectStage ?? source.projectStage),
        readingMode: reading === 'beginner' || reading === 'professional' ? reading : defaultReadingMode(prefs.role),
        notify: {
            frequency: text(asRecord(extra.notify).frequency ?? source.notifyFrequency) || '即时',
            channel: text(asRecord(extra.notify).channel ?? source.notifyChannel) || '站内',
            window: text(asRecord(extra.notify).window ?? source.notifyWindow) || '08:00-20:00',
        },
        personalized: prefs.personalized,
        tags: prefs.tags,
        follows: cleanFollows(extra.follows ?? source.follows),
        understoodTerms: textList(extra.understoodTerms ?? source.understoodTerms),
    };
}

function cleanFollows(value: unknown): FollowItem[] {
    if (!Array.isArray(value)) return [];
    const kinds = new Set(['省份', '主题', '文号', '数据集', '项目']);
    return value.flatMap((item) => {
        const row = asRecord(item);
        const kind = text(row.kind);
        const name = text(row.value);
        if (!kind || !name || !kinds.has(kind)) return [];
        return [{ kind: kind as FollowItem['kind'], value: name }];
    });
}

/** 标签对用户可见。命中底线词表的标签不进入展示。 */
export function visibleTags(tags: PreferenceTag[]): PreferenceTag[] {
    const banned = bottomLineTerms();
    return tags.filter((tag) => !banned.some((term) => tag.label.toLowerCase().includes(term.toLowerCase())));
}

export function markUnderstood(profile: UserProfileDraft, termId: string): UserProfileDraft {
    if (profile.understoodTerms.includes(termId)) return profile;
    return { ...profile, understoodTerms: [...profile.understoodTerms, termId] };
}
