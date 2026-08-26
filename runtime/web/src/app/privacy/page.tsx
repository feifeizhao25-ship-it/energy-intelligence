import Link from 'next/link';
import { getLocale } from 'next-intl/server';

const privacyCopy = {
  zh: {
    title: '隐私政策', date: '生效日期：2026年8月22日', back: '返回登录',
    sections: [
      ['我们处理的信息', '包括注册与认证信息、用户主动提交的项目参数、产品使用记录、支付状态以及为安全审计所需的最少日志。平台不会要求用户提交与分析无关的敏感信息。'],
      ['处理目的', '用于提供计算、报告、个性化展示、账户安全、会员权益和客户支持。个性化结果应提供原因说明，并允许用户关闭或重置。'],
      ['来源与第三方', '外部数据和AI服务应在结果中标注来源。向支付、短信、地图或AI服务提供商传输数据前，遵循必要性和最小化原则，并按适用法律签署数据处理安排。'],
      ['保存与安全', '不同数据设置明确保存期限；到期后删除或匿名化。使用访问控制、传输加密、审计日志、备份和事故响应机制保护数据。'],
      ['用户权利', '用户可以查询、更正、导出或删除个人信息，也可以撤回同意、关闭个性化和注销账户。法律要求保留的交易或审计数据会单独说明。'],
      ['发布前必填信息', '运营主体名称、注册地址、隐私负责人联系方式、备案编号、第三方共享清单和数据保存期限必须在正式上线前填写并经法律顾问审核。'],
    ],
  },
  en: {
    title: 'Privacy Policy', date: 'Effective date: August 22, 2026', back: 'Back to sign in',
    sections: [
      ['Information we process', 'We may process registration and authentication details, project inputs you submit, product usage records, payment status, and the minimum logs required for security and audit. We do not ask for sensitive information unrelated to an assessment.'],
      ['Why we process it', 'We use information to provide calculations, reports, personalization, account security, membership entitlements, and support. Personalized results explain why they appear and can be disabled or reset.'],
      ['Sources and service providers', 'External data and AI services are identified in the relevant output. Transfers to payment, messaging, mapping, hosting, or AI providers follow data-minimization requirements and applicable data-processing terms.'],
      ['Retention and security', 'Each data category must have a defined retention period. We use access controls, encryption in transit, audit logs, backups, and incident-response procedures, and delete or de-identify data when it is no longer required.'],
      ['Your choices and rights', 'Subject to applicable law, you may request access, correction, export, or deletion; withdraw consent; disable personalization; or close your account. Legally required transaction and audit records are handled separately.'],
      ['Required operator details', 'The legal entity, registered address, privacy contact, service-provider list, regional transfer terms, and final retention schedule must be completed and reviewed by counsel before public launch.'],
    ],
  },
} as const;

export default async function PrivacyPage() {
  const content = (await getLocale()) === 'en' ? privacyCopy.en : privacyCopy.zh;
  return <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-700"><article className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-sm"><h1 className="text-3xl font-black text-slate-900">{content.title}</h1><p className="mt-2 text-sm text-slate-500">{content.date}</p><div className="mt-8 space-y-6 leading-7">{content.sections.map(([title, body]) => <section key={title}><h2 className="font-bold text-slate-900">{title}</h2><p>{body}</p></section>)}</div><Link href="/login" className="mt-8 inline-block font-bold text-green-600">{content.back}</Link></article></main>;
}
