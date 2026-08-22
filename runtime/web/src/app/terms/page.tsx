import Link from 'next/link';

export default function TermsPage() {
  return <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-700"><article className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-sm">
    <h1 className="text-3xl font-black text-slate-900">服务条款</h1>
    <p className="mt-2 text-sm text-slate-500">生效日期：2026年8月22日</p>
    <div className="mt-8 space-y-6 leading-7">
      <section><h2 className="font-bold text-slate-900">1. 服务性质</h2><p>新能源智库提供数据整理、计算与辅助分析工具，不构成投资、工程、法律或安全保证。重要项目决策应由具备资质的专业人员复核。</p></section>
      <section><h2 className="font-bold text-slate-900">2. 数据与结果</h2><p>结果会区分用户输入、外部来源、模型假设和计算结论。数据不足或来源不可用时，系统可能拒绝生成结论，不以模拟数据替代真实数据。</p></section>
      <section><h2 className="font-bold text-slate-900">3. 账户与安全</h2><p>用户应妥善保管账户信息，不得上传无权处理的数据，不得利用服务实施违法、侵权或破坏平台安全的活动。</p></section>
      <section><h2 className="font-bold text-slate-900">4. 付费服务</h2><p>套餐价格、权益、期限、自动续费和退款条件以购买页面及支付平台确认页面为准。会员仅在支付平台确认后生效。</p></section>
      <section><h2 className="font-bold text-slate-900">5. 内容标识</h2><p>AI生成或合成的文本、图片、音频、视频和报告可能包含显式及隐式标识，用户不得恶意删除或篡改依法要求的标识。</p></section>
      <section><h2 className="font-bold text-slate-900">6. 联系与更新</h2><p>运营主体、注册地址、备案编号和正式联系方式必须在生产发布前补充。本条款发生重大变化时，将在生效前通过产品内公告通知。</p></section>
    </div>
    <Link href="/login" className="mt-8 inline-block font-bold text-green-600">返回登录</Link>
  </article></main>;
}
