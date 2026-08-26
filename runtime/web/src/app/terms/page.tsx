import Link from 'next/link';
import { getLocale } from 'next-intl/server';

const termsCopy = {
  zh: {
    title: '服务条款', date: '生效日期：2026年8月22日', back: '返回登录',
    sections: [
      ['1. 服务性质', '新能源智库提供数据整理、计算与辅助分析工具，不构成投资、工程、法律或安全保证。重要项目决策应由具备资质的专业人员复核。'],
      ['2. 数据与结果', '结果会区分用户输入、外部来源、模型假设和计算结论。数据不足或来源不可用时，系统可能拒绝生成结论，不以模拟数据替代真实数据。'],
      ['3. 账户与安全', '用户应妥善保管账户信息，不得上传无权处理的数据，不得利用服务实施违法、侵权或破坏平台安全的活动。'],
      ['4. 付费服务', '套餐价格、权益、期限、自动续费和退款条件以购买页面及支付平台确认页面为准。会员仅在支付平台确认后生效。'],
      ['5. 内容标识', 'AI生成或合成的文本、图片、音频、视频和报告可能包含显式及隐式标识，用户不得恶意删除或篡改依法要求的标识。'],
      ['6. 联系与更新', '运营主体、注册地址、备案编号和正式联系方式必须在生产发布前补充。本条款发生重大变化时，将在生效前通过产品内公告通知。'],
    ],
  },
  en: {
    title: 'Terms of Service', date: 'Effective date: August 22, 2026', back: 'Back to sign in',
    sections: [
      ['1. Service scope', 'Energy Intelligence provides data organization, calculation, and decision-support tools. It does not provide an investment, engineering, legal, tax, grid-connection, or safety guarantee. Qualified professionals must review material project decisions.'],
      ['2. Data and outputs', 'Outputs distinguish user inputs, external sources, model assumptions, and calculated results. When evidence is missing, unavailable, or stale, the service may decline to produce a conclusion and must not substitute fabricated data.'],
      ['3. Accounts and security', 'You are responsible for protecting account credentials and may submit only data you are authorized to process. You must not use the service for unlawful, infringing, deceptive, or security-disrupting activity.'],
      ['4. Paid services', 'Prices, entitlements, term, renewal, cancellation, and refund conditions are shown at checkout and by the payment provider. Access is activated only after verified payment confirmation.'],
      ['5. AI and synthetic-content labels', 'AI-generated or synthetic text, images, audio, video, and reports may contain visible or machine-readable labels. You must not remove labels required by applicable law or platform rules.'],
      ['6. Operator details and updates', 'The legal entity, address, applicable-law terms, support details, and dispute process must be completed before public launch. Material changes will be notified before they take effect where required.'],
    ],
  },
} as const;

export default async function TermsPage() {
  const content = (await getLocale()) === 'en' ? termsCopy.en : termsCopy.zh;
  return <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-700"><article className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-sm"><h1 className="text-3xl font-black text-slate-900">{content.title}</h1><p className="mt-2 text-sm text-slate-500">{content.date}</p><div className="mt-8 space-y-6 leading-7">{content.sections.map(([title, body]) => <section key={title}><h2 className="font-bold text-slate-900">{title}</h2><p>{body}</p></section>)}</div><Link href="/login" className="mt-8 inline-block font-bold text-green-600">{content.back}</Link></article></main>;
}
