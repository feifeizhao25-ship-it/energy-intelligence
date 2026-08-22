import Link from 'next/link';

export default function PrivacyPage() {
  return <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-700"><article className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-sm">
    <h1 className="text-3xl font-black text-slate-900">隐私政策</h1>
    <p className="mt-2 text-sm text-slate-500">生效日期：2026年8月22日</p>
    <div className="mt-8 space-y-6 leading-7">
      <section><h2 className="font-bold text-slate-900">我们处理的信息</h2><p>包括注册与认证信息、用户主动提交的项目参数、产品使用记录、支付状态以及为安全审计所需的最少日志。平台不会要求用户提交与分析无关的敏感信息。</p></section>
      <section><h2 className="font-bold text-slate-900">处理目的</h2><p>用于提供计算、报告、个性化展示、账户安全、会员权益和客户支持。个性化结果应提供原因说明，并允许用户关闭或重置。</p></section>
      <section><h2 className="font-bold text-slate-900">来源与第三方</h2><p>外部数据和AI服务应在结果中标注来源。向支付、短信、地图或AI服务提供商传输数据前，遵循必要性和最小化原则，并按适用法律签署数据处理安排。</p></section>
      <section><h2 className="font-bold text-slate-900">保存与安全</h2><p>不同数据设置明确保存期限；到期后删除或匿名化。使用访问控制、传输加密、审计日志、备份和事故响应机制保护数据。</p></section>
      <section><h2 className="font-bold text-slate-900">用户权利</h2><p>用户可以查询、更正、导出或删除个人信息，也可以撤回同意、关闭个性化和注销账户。法律要求保留的交易或审计数据会单独说明。</p></section>
      <section><h2 className="font-bold text-slate-900">发布前必填信息</h2><p>运营主体名称、注册地址、隐私负责人联系方式、备案编号、第三方共享清单和数据保存期限必须在正式上线前填写并经法律顾问审核。</p></section>
    </div>
    <Link href="/login" className="mt-8 inline-block font-bold text-green-600">返回登录</Link>
  </article></main>;
}
