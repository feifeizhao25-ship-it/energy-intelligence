'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/design-system';
import { PROCUREMENT_FIELDS, PROCUREMENT_KINDS, reviewProcurement, type ProcurementKind } from '@/lib/procurement/requests';

/** 报价、合同、发票只登记申请。不创建支付。 */
export function ProcurementForm({ kind = 'quote' }: { kind?: ProcurementKind }) {
    const [values, setValues] = useState<Record<string, string>>({});
    const [note, setNote] = useState('');
    const title = PROCUREMENT_KINDS[kind];

    function submit() {
        setNote(reviewProcurement(kind, values).note);
    }

    return (
        <form
            data-testid="procurement-form"
            className="ei-panel mx-auto max-w-xl space-y-4"
            onSubmit={(event) => {
                event.preventDefault();
                submit();
            }}
        >
            <PageHeader
                kicker="对公"
                title={title}
                crumbs={[{ href: '/enterprise', label: '企业空间' }, { href: `/enterprise/${kind}`, label: title }]}
                summary="一次填写户名、开户行、账号和税号。这里不产生支付，也不生成发票号。合同与发票模板待企业微信审批后才会发出。"
            />
            {PROCUREMENT_FIELDS.map((field) => (
                <label key={field.key} className="block text-sm">
                    {field.label}
                    <input
                        value={values[field.key] || ''}
                        onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2"
                    />
                </label>
            ))}
            <button type="submit" className="rounded-xl bg-[var(--navy)] px-4 py-2 text-sm text-white">提交申请</button>
            {note ? <p data-testid="procurement-note">{note}</p> : null}
            <p className="text-sm text-[var(--ink-soft)]">
                <Link href="/enterprise/quote" className="underline">报价</Link>
                {' · '}
                <Link href="/enterprise/contract" className="underline">合同</Link>
                {' · '}
                <Link href="/enterprise/invoice" className="underline">发票</Link>
            </p>
        </form>
    );
}
