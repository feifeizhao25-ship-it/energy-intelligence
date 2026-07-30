import Link from 'next/link';
import SiteHeader from '../components/SiteHeader';

export default function HomePage() {
  return (
    <main className="shell">
      <SiteHeader />
      <section className="hero">
        <div>
          <div className="eyebrow">为你的项目筛选今天最值得关注的变化</div>
          <h1>先看结论，<br />再决定是否深入。</h1>
          <p className="lead">政策、价格和项目风险被整理成普通人能理解的行动建议。每个结论同时展示来源、核验时间和可信度，不让复杂数据变成信息堆砌。</p>
          <div className="actions">
            <Link className="button buttonPrimary" href="/experience-week">查看我的个性化一周</Link>
            <Link className="button buttonGhost" href="/ai">询问 AI 助手</Link>
          </div>
        </div>
        <aside className="trustCard">
          <div className="eyebrow">今日证据健康度</div>
          <div className="trustScore">92%</div>
          <p className="lead" style={{fontSize: 13}}>仅统计仍在核验周期内、具有明确发布机构和可访问链接的资料。</p>
          <div className="trustMeta">
            <div className="trustRow"><span>政策资料</span><span className="status">已核验</span></div>
            <div className="trustRow"><span>价格数据</span><span className="status">7天内更新</span></div>
            <div className="trustRow"><span>独立交叉来源</span><span>2个机构</span></div>
          </div>
        </aside>
      </section>
      <div className="sectionHead"><div><h2>今天与你有关的三件事</h2><p>根据你的项目阶段、地区和阅读行为排序</p></div></div>
      <section className="grid3">
        <article className="card"><h3>并网时间风险上升</h3><p>华东地区同类项目近期等待时间增加。建议本周确认接入系统报告的补充材料。</p><div className="metric"><strong>+18</strong><span>预计等待天数</span></div><div className="sourceLine">来源：电网公开信息 · 今日核验</div></article>
        <article className="card"><h3>组件价格进入观察区间</h3><p>当前价格变化尚不足以支持立即锁价。系统将在达到你的目标区间时提醒。</p><div className="metric"><strong>1.2%</strong><span>七日变化</span></div><div className="sourceLine">来源：两家独立行业机构 · 2日前核验</div></article>
        <article className="card"><h3>会员权益使用情况</h3><p>本月还可生成 8 份专业报告，深度测算和资料追溯功能均已启用。</p><div className="metric"><strong>8</strong><span>份报告额度</span></div><div className="sourceLine">专业会员 · 下月1日重置</div></article>
      </section>
      <div className="sectionHead"><div><h2>使用边界</h2></div></div>
      <div className="notice">页面内容用于信息辅助和方案比较，不构成投资、法律、税务或并网承诺。影响重大决策的内容必须打开原始来源，并由相应专业人员复核。</div>
    </main>
  );
}
