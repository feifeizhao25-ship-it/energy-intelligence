'use client';

import { useState } from 'react';
import { markUnderstood, profileFromUsageMetadata, visibleTags, type UserProfileDraft } from '@/lib/dashboard/user-profile';

const EMPTY = profileFromUsageMetadata({
    preferences: { role: 'ci_owner', province: '山东', interest: 'solar', personalized: true, tags: [{ id: 't1', label: '分布式光伏', source: '设置' }] },
});

/** 设置页可编辑的画像字段。保存前只留在本页，示例数据会标明。 */
export function ProfileDraftFields() {
    const [profile, setProfile] = useState<UserProfileDraft>(EMPTY);
    const [saved, setSaved] = useState('');
    const tags = visibleTags(profile.tags);
    function update<K extends keyof UserProfileDraft>(key: K, value: UserProfileDraft[K]) {
        setProfile((current) => ({ ...current, [key]: value }));
    }
    return (
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">我的画像</h2>
                <span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-800">示例</span>
            </div>
            <div className="grid gap-3 text-sm md:grid-cols-2">
                <label>角色
                    <input className="mt-1 w-full rounded-xl border px-3 py-2" value={profile.role || ''} onChange={(event) => update('role', event.target.value as UserProfileDraft['role'])} />
                </label>
                <label>细分角色
                    <input className="mt-1 w-full rounded-xl border px-3 py-2" value={profile.subRole || ''} onChange={(event) => update('subRole', event.target.value || null)} />
                </label>
                <label>项目阶段
                    <input className="mt-1 w-full rounded-xl border px-3 py-2" value={profile.projectStage || ''} onChange={(event) => update('projectStage', event.target.value || null)} />
                </label>
                <label>阅读模式
                    <select className="mt-1 w-full rounded-xl border px-3 py-2" value={profile.readingMode} onChange={(event) => update('readingMode', event.target.value as UserProfileDraft['readingMode'])}>
                        <option value="beginner">新手</option>
                        <option value="professional">专业</option>
                    </select>
                </label>
                <label>提醒频率
                    <select className="mt-1 w-full rounded-xl border px-3 py-2" value={profile.notify.frequency} onChange={(event) => update('notify', { ...profile.notify, frequency: event.target.value })}>
                        <option>即时</option>
                        <option>每日汇总</option>
                        <option>每周</option>
                    </select>
                </label>
                <label>提醒渠道
                    <select className="mt-1 w-full rounded-xl border px-3 py-2" value={profile.notify.channel} onChange={(event) => update('notify', { ...profile.notify, channel: event.target.value })}>
                        <option>站内</option>
                        <option>企业微信</option>
                        <option>邮件</option>
                    </select>
                </label>
            </div>
            <p className="mt-3 text-xs text-slate-500">省份：{profile.provinces.join('、') || '未设置'}。主题：{profile.topics.join('、') || '未设置'}。</p>
            <div className="mt-3 flex flex-wrap gap-2">
                {tags.map((tag) => (
                    <button key={tag.id} type="button" className="rounded-full border px-2 py-1 text-xs" onClick={() => update('tags', profile.tags.filter((item) => item.id !== tag.id))}>
                        {tag.label} · 删除
                    </button>
                ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => setSaved('已记录在本页。写入账号前仍按现有偏好接口保存。')}>保存画像</button>
                <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => setProfile((current) => markUnderstood(current, 't001'))}>术语懂了</button>
            </div>
            {saved ? <p className="mt-2 text-xs text-slate-600">{saved}</p> : null}
            {profile.understoodTerms.length ? <p className="mt-1 text-xs text-slate-500">已理解 {profile.understoodTerms.length} 条术语。</p> : null}
        </section>
    );
}
