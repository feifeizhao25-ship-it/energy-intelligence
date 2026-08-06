import { useState } from 'react';
import SiteHeader from '../components/SiteHeader';

const personas = [
  { name: '林岚', role: '家庭业主', goal: '控制电费与回本周期', metric: '预计回本 7.8 年', action: '核对近 12 个月电费单，再决定是否预约勘测', signals: ['只保留屋顶面积、电费和预算三项', '用每月少付约 420 元解释收益', '显示电价与日照数据的机构和日期', '把反复查看的回本卡移到首位', '仅在回本变化超过 6 个月时提醒', '比较自购、贷款和暂缓三种选择', '允许清除家庭用能与浏览记录'] },
  { name: '陈川', role: '项目开发者', goal: '降低并网与审批风险', metric: '关键路径 43 天', action: '先向属地电网确认接入容量和资料清单', signals: ['记录省份、项目阶段与计划并网日', '把“接入受限”解释为工期和成本影响', '列出主管部门、原文链接与核验日期', '把收藏的并网节点置顶且不隐藏红线', '容量或审批周期越过阈值才提醒', '比较原方案、降容和分期并网', '导出本周关键路径并检查偏好'] },
  { name: '周宁', role: '投资经理', goal: '比较收益与风险变化', metric: '下行情景 IRR 6.4%', action: '要求项目方补齐限电与电价敏感性假设', signals: ['锁定币种、持有期和最低收益要求', '把 IRR、DSCR 解释为现金流安全垫', '为关键假设附原始数据和计算口径', '按已保存的下行情景调整卡片顺序', '收益下降 50 个基点以上才提醒', '比较持有、重谈条款和退出', '审计模型版本、证据日期与免责声明'] },
  { name: '唐悦', role: '园区负责人', goal: '规划用能与储能方案', metric: '需量峰值 -11%', action: '先确认 15 分钟负荷曲线和生产班次', signals: ['记录峰谷电价、负荷和保供目标', '用“少交需量费”解释削峰指标', '标出计量数据缺口与设备数据来源', '将停电韧性和需量费卡片前置', '峰值或故障率越过个人阈值才提醒', '比较纯光伏、光储和需求响应', '复核权限、设备数据和节省测算'] },
  { name: '何川', role: '行业分析师', goal: '追踪政策与数据可信度', metric: '来源新鲜度 96%', action: '复核一条单一来源结论并补充独立佐证', signals: ['选择地区、技术和统计口径', '把政策术语改写成影响对象和生效时间', '展示发布机构、原文、发布日期和核验日', '按常用机构排序但保留反方证据', '只有实质性修订或数据回溯才提醒', '比较基准、乐观和保守口径', '检查引用链、失效链接和个性化记录'] },
];
const days = [
  ['建立关注清单', '系统只询问项目地区、阶段和最关心的问题，隐藏无关模块。', '偏好识别', 'profile-preference-v1', 64],
  ['解释关键指标', '把专业指标改写成“它为什么影响你”和“现在该做什么”。', '通俗解释', 'plain-language-energy-v2', 70],
  ['连接可靠来源', '为事实性结论补充发布机构、原文链接与核验日期。', '来源追溯', 'rag-provenance-gate-v2', 76],
  ['观察行为变化', '根据阅读、收藏和忽略行为重新排列首页卡片。', '行为学习', 'ranking-feedback-v1', 81],
  ['发现风险信号', '只推送超过个人阈值的变化，避免通知疲劳。', '风险预警', 'threshold-monitor-v2', 85],
  ['形成决策方案', '把分散信息整理成可比较的三个行动选项。', '方案比较', 'scenario-compare-v2', 89],
  ['回顾这一周', '展示系统学到了什么，并允许删除、关闭或修改个性化。', '来源核验', 'evidence-audit-v2', 92],
];

export default function ExperienceWeekPage() {
  const [persona, setPersona] = useState(0);
  const [day, setDay] = useState(6);
  const selected = personas[persona];
  const detail = days[day];
  return (
    <main className="shell">
      <SiteHeader />
      <section className="hero" style={{gridTemplateColumns: '1fr', paddingBottom: 12}}>
        <div><div className="eyebrow">可交互验收场景</div><h1 style={{fontSize: 'clamp(32px,5vw,52px)'}}>五类用户，连续七天，<br />首页应该越用越懂你。</h1><p className="lead">选择不同用户和日期，检查信息排序、表达方式、可信度及所调用的专业能力是否真正发生变化。</p></div>
      </section>
      <section className="weekLayout">
        <aside className="card personaList">
          {personas.map((item, index) => <button key={item.name} type="button" aria-pressed={persona === index} aria-label={`${item.name}，${item.role}，关注${item.goal}`} className={`personaButton ${persona === index ? 'active' : ''}`} onClick={() => setPersona(index)}><strong>{item.name} · {item.role}</strong>{item.goal}</button>)}
        </aside>
        <div>
          <div className="dayRail" aria-label="连续七天个性化进度">{days.map((_, index) => <button key={index} type="button" aria-pressed={day === index} className={`dayButton ${day === index ? 'active' : ''}`} onClick={() => setDay(index)}>第{index + 1}天</button>)}</div>
          <article className="card experience" aria-live="polite">
            <div className="experienceTop">
              <div><div className="eyebrow">{selected.name} · {selected.role}</div><h2>{detail[0]}</h2><p className="lead" style={{fontSize: 15}}>{detail[1]}</p><span className="skill">本日能力：{detail[2]} · {detail[3]}</span></div>
              <div className="confidence"><strong>{detail[4]}%</strong><span>证据可信度</span></div>
            </div>
            <div className="timeline">
              <div className="timelineItem"><b>今天优先展示：</b>{selected.signals[day]}。<span className="personalMetric">{selected.metric}</span></div>
              <div className="timelineItem"><b>建议下一步：</b>{selected.action}。高级会员可保存多方案、设置更多阈值并导出带来源的 Word/PDF；基础用户仍可查看结论和来源。</div>
              <div className="timelineItem"><b>证据与控制：</b>{day === 2 ? '事实结论必须显示发布机构、原文链接和 2026-07-30 核验日期；单一来源会明确标记“待交叉验证”。' : '监管、安全和重大风险不会因个性化而消失；你可暂停、修改或删除这一周记录。'}</div>
            </div>
            <p className="notice">结果用于辅助决策，不替代投资、法律或工程意见。系统不会用会员等级降低安全、合规或来源透明度。</p>
          </article>
        </div>
      </section>
    </main>
  );
}
