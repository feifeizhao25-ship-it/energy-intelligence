'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save, SlidersHorizontal } from 'lucide-react';
import { ROLES, ROLE_LABELS, INTERESTS, INTEREST_LABELS, PROVINCES, type Preferences } from '@/lib/dashboard/personalization';

/** 设置页「工作台个性化」：角色、所在省份、关注领域，以及关闭个性化的开关。免费用户同样可用。 */
export default function PersonalizationSettings() {
    const [prefs, setPrefs] = useState<Preferences>({ role: null, province: null, interest: null, personalized: true, tags: [] });
    const [state, setState] = useState<'loading' | 'idle' | 'saving' | 'saved' | 'error'>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetch('/api/user/preferences', { cache: 'no-store' })
            .then(r => r.json())
            .then(body => { if (body?.preferences) setPrefs(body.preferences); setState('idle'); })
            .catch(() => setState('idle'));
    }, []);

    async function save() {
        setState('saving');
        setMessage('');
        try {
            const res = await fetch('/api/user/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prefs) });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : '保存失败');
            setState('saved');
            setMessage('已保存，工作台下次打开时生效');
        } catch (e) {
            setState('error');
            setMessage(e instanceof Error && /[一-鿿]/.test(e.message) ? e.message : '保存失败，请稍后重试');
        }
    }

    const select = 'w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium';
    return (
        <section id="personalization" className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-5">
            <div>
                <h2 className="flex items-center gap-2 font-black text-slate-900"><SlidersHorizontal className="w-4 h-4" />工作台个性化</h2>
                <p className="mt-1 text-xs text-slate-500">工作台会按你的角色调整模块顺序，按所在省份显示电价与已审核政策。免费版同样适用；也可以关闭个性化，回到通用版。</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="space-y-2 text-xs font-bold text-slate-500">
                    <span>角色</span>
                    <select className={select} value={prefs.role ?? ''} onChange={e => setPrefs({ ...prefs, role: (e.target.value || null) as Preferences['role'] })}>
                        <option value="">未选择</option>
                        {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                </label>
                <label className="space-y-2 text-xs font-bold text-slate-500">
                    <span>项目所在省份</span>
                    <select className={select} value={prefs.province ?? ''} onChange={e => setPrefs({ ...prefs, province: e.target.value || null })}>
                        <option value="">未选择（按项目所在地推断）</option>
                        {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </label>
                <label className="space-y-2 text-xs font-bold text-slate-500">
                    <span>关注领域</span>
                    <select className={select} value={prefs.interest ?? ''} onChange={e => setPrefs({ ...prefs, interest: (e.target.value || null) as Preferences['interest'] })}>
                        <option value="">未选择</option>
                        {INTERESTS.map(i => <option key={i} value={i}>{INTEREST_LABELS[i]}</option>)}
                    </select>
                </label>
            </div>
            <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500">我的标签</p>
                {(prefs.tags ?? []).length === 0 && <p className="text-xs text-slate-500">还没有标签。标签只来自你的操作记录，不会自动生成。</p>}
                <ul className="space-y-2">
                    {(prefs.tags ?? []).map(tag => (
                        <li key={tag.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                            <span>{tag.label}<span className="ml-2 text-xs text-slate-500">来源：{tag.source}</span></span>
                            <button type="button" className="text-xs font-bold text-rose-700" onClick={() => setPrefs({ ...prefs, tags: (prefs.tags ?? []).filter(item => item.id !== tag.id) })}>删除</button>
                        </li>
                    ))}
                </ul>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={prefs.personalized} onChange={e => setPrefs({ ...prefs, personalized: e.target.checked })} />
                开启个性化（关闭后工作台显示通用版）
            </label>
            <button type="button" className="text-sm font-bold text-slate-700 underline" onClick={() => setPrefs({ ...prefs, personalized: false })}>一键关闭个性化</button>
            <div className="flex items-center gap-3">
                <button type="button" onClick={save} disabled={state === 'saving' || state === 'loading'}
                    className="bg-green-600 text-white px-6 py-2.5 rounded-2xl font-bold text-sm flex items-center gap-2 disabled:opacity-50">
                    {state === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}保存个性化设置
                </button>
                {message && <span role="status" className={state === 'error' ? 'text-xs text-rose-600' : 'text-xs text-emerald-600'}>{message}</span>}
            </div>
        </section>
    );
}
