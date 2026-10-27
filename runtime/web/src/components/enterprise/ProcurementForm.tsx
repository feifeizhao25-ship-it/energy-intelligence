'use client';

import { useState } from 'react';

const FIELDS = [
    { key: 'account_name', label: '户名' },
    { key: 'bank_name', label: '开户行' },
    { key: 'account_number', label: '账号' },
    { key: 'tax_id', label: '税号' },
] as const;

/** 只收集四项。未发送、未批准，不写入审批记录。 */
export function ProcurementForm() {
    const [values, setValues] = useState<Record<string, string>>({});
    const [note, setNote] = useState('');

    function submit() {
        const missing = FIELDS.filter((field) => !(values[field.key] || '').trim()).map((field) => field.label);
        setNote(missing.length
            ? `还缺${missing.join('、')}。审批尚未发送。`
            : '四项已记下。审批尚未发送，状态为待企业微信审批。');
    }

    return (
        <form
            data-testid="procurement-form"
            className="space-y-4 rounded-3xl border border-slate-100 bg-white p-8"
            onSubmit={(event) => {
                event.preventDefault();
                submit();
            }}
        >
            <h3 className="text-2xl font-black text-slate-900">对公采购</h3>
            <p className="text-sm text-slate-500">一次填写户名、开户行、账号和税号。合同与发票模板待企业微信审批后才会发出。</p>
            {FIELDS.map((field) => (
                <label key={field.key} className="block text-sm font-bold text-slate-700">
                    {field.label}
                    <input
                        value={values[field.key] || ''}
                        onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                        className="mt-1 w-full rounded-2xl bg-slate-50 p-3 font-medium outline-none"
                    />
                </label>
            ))}
            <button type="submit" className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-bold text-white">提交材料</button>
            {note ? <p data-testid="procurement-note">{note}</p> : null}
        </form>
    );
}
