import { useState } from 'react';
import SiteHeader from '../components/SiteHeader';

const personas = [
  { name: '林岚', role: '家庭业主', goal: '控制电费与回本周期' },
  { name: '陈川', role: '项目开发者', goal: '降低并网与审批风险' },
  { name: '周宁', role: '投资经理', goal: '比较收益与风险变化' },
  { name: '唐悦', role: '园区负责人', goal: '规划用能与储能方案' },
  { name: '何川', role: '行业分析师', goal: '追踪政策与数据可信度' },
];
const days = [
  ['建立关注清单', '系统只询问项目地区、阶段和最关心的问题，隐藏无关模块。', '偏好识别', 64],
  ['解释关键指标', '把专业指标改写成“它为什么影响你”和“现在该做什么”。', '通俗解释', 70],
  ['连接可靠来源', '为事实性结论补充发布机构、链接与核验日期。', '来源追溯', 76],
  ['观察行为变化', '根据阅读、收藏和忽略行为重新排列首页卡片。', '行为学习', 81],
  ['发现风险信号', '只推送超过个人阈值的变化，避免通知疲劳。', '风险预警', 85],
  ['形成决策方案', '把分散信息整理成可比较的三个行动选项。', '方案比较', 89],
  ['回顾这一周', '展示系统学到了什么，并允许删除、关闭或修改个性化。', '来源核验', 92],
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
          {personas.map((item, index) => <button key={item.name} className={`personaButton ${persona === index ? 'active' : ''}`} onClick={() => setPersona(index)}><strong>{item.name} · {item.role}</strong>{item.goal}</button>)}
        </aside>
        <div>
          <div className="dayRail">{days.map((_, index) => <button key={index} className={`dayButton ${day === index ? 'active' : ''}`} onClick={() => setDay(index)}>第{index + 1}天</button>)}</div>
          <article className="card experience">
            <div className="experienceTop">
              <div><div className="eyebrow">{selected.name} · {selected.role}</div><h2>{detail[0]}</h2><p className="lead" style={{fontSize: 15}}>{detail[1]}</p><span className="skill">本日能力：{detail[2]}</span></div>
              <div className="confidence"><strong>{detail[3]}%</strong><span>证据可信度</span></div>
            </div>
            <div className="timeline">
              <div className="timelineItem"><b>今天优先展示：</b>{selected.goal}相关的两条变化，以及一个明确行动建议。</div>
              <div className="timelineItem"><b>与昨天相比：</b>降低被连续忽略主题的权重，保留收藏过的来源类型。</div>
              <div className="timelineItem"><b>你仍可控制：</b>关闭个性化、修改关注地区，或删除这一周的行为记录。</div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
