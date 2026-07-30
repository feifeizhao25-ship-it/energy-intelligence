'use client';

import { useState } from 'react';
import styles from './page.module.css';

const personas = [
  ['Maya Chen', 'Distributed-energy owner', 'Cash flow and bill resilience'],
  ['Leo Martin', 'Project developer', 'Permitting and interconnection'],
  ['Sofia Reyes', 'Infrastructure investor', 'Risk-adjusted returns'],
  ['Noah Williams', 'Portfolio operator', 'Availability and revenue loss'],
  ['Aisha Bello', 'Market analyst', 'Policy evidence and data lineage'],
];
const week = [
  ['Set the decision lens', 'The product asks for market, project stage and decision horizon before showing metrics.', 'Preference setup', 62],
  ['Translate the economics', 'IRR, DSCR and LCOE are explained in terms of the decision they can change.', 'Plain-language finance', 69],
  ['Map the approval path', 'Permitting and interconnection tasks are ordered by dependency, owner and deadline.', 'Workflow mapping', 76],
  ['Learn from signals', 'Saved evidence and dismissed cards alter the next briefing without hiding material risk.', 'Behavior learning', 81],
  ['Watch material changes', 'Alerts are triggered by personal thresholds rather than generic market movement.', 'Threshold monitoring', 85],
  ['Compare real options', 'Three actions are compared by cost, delay, reversibility and evidence strength.', 'Scenario comparison', 89],
  ['Audit the week', 'The user can inspect learned preferences, evidence freshness and every personalization control.', 'Evidence audit', 93],
];

export default function ExperienceWeek() {
  const [persona, setPersona] = useState(0);
  const [day, setDay] = useState(6);
  const p = personas[persona];
  const d = week[day];
  return <main className={styles.page}><div className={styles.wrap}>
    <div className={styles.kicker}>Personalized decision briefing</div>
    <h1 className={styles.title}>Five global energy roles.<br/>A briefing that earns relevance.</h1>
    <p className={styles.intro}>This is not a translated domestic dashboard. It prioritizes the questions global users repeatedly act on: project economics, approvals, incentives, operational exposure and auditable evidence.</p>
    <section className={styles.layout}>
      <aside className={`${styles.panel} ${styles.personas}`}>{personas.map((x,i)=><button key={x[0]} className={`${styles.persona} ${persona===i?styles.active:''}`} onClick={()=>setPersona(i)}><strong>{x[0]} · {x[1]}</strong>{x[2]}</button>)}</aside>
      <div>
        <div className={styles.days}>{week.map((_,i)=><button key={i} className={`${styles.day} ${day===i?styles.active:''}`} onClick={()=>setDay(i)}>Day {i+1}</button>)}</div>
        <article className={styles.panel}>
          <div className={styles.top}><div><div className={styles.kicker}>{p[0]} · {p[1]}</div><h2>{d[0]}</h2><p className={styles.intro} style={{fontSize:15}}>{d[1]}</p><span className={styles.skill}>Active skill: {d[2]}</span></div><div className={styles.confidence}><strong>{d[3]}%</strong>evidence confidence</div></div>
          <div className={styles.cards}><div className={styles.card}><b>Priority today</b>Two changes tied to {p[2].toLowerCase()}, plus one reversible next action.</div><div className={styles.card}><b>Changed since yesterday</b>Dismissed topics move down; regulatory and safety-critical changes never disappear.</div><div className={styles.card}><b>Evidence gate</b>Stale sources are excluded; material claims require publisher, date and traceable URL.</div></div>
          <div className={styles.control}>Personalization can be paused, edited or erased. Recommendations are decision support, not investment, tax or legal advice.</div>
        </article>
      </div>
    </section>
  </div></main>;
}
