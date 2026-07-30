'use client';

import { useState } from 'react';
import styles from './page.module.css';

const personas = [
  { name:'Maya Chen', role:'Distributed-energy owner', lens:'Cash flow and bill resilience', metric:'Bill exposure −14%', action:'Validate 12 months of interval data before requesting bids', signals:['Set market, tariff and ownership horizon','Explain savings as monthly cash-flow resilience','Trace tariff and irradiance inputs to dated publishers','Move saved payback evidence above generic news','Alert only when payback shifts by more than six months','Compare cash, debt and defer options','Review learned preferences and erase usage history'] },
  { name:'Leo Martin', role:'Project developer', lens:'Permitting and interconnection', metric:'Critical path 11 weeks', action:'Confirm study queue, capacity and filing owner with the utility', signals:['Capture jurisdiction, stage and commercial-operation date','Translate queue constraints into delay and carrying cost','Map authority, dependency, filing and verified source','Prioritize saved approval tasks without hiding blockers','Alert only on material queue or permit movement','Compare base design, downsizing and staged energization','Export the critical path and audit preference changes'] },
  { name:'Sofia Reyes', role:'Infrastructure investor', lens:'Risk-adjusted returns', metric:'Downside IRR 6.4%', action:'Request curtailment and merchant-price sensitivities', signals:['Lock currency, hold period and hurdle rate','Explain IRR and DSCR as cash-flow protection','Attach model lineage, units and publication dates','Rank saved downside cases above headline forecasts','Alert when return moves at least 50 basis points','Compare hold, reprice and exit options','Audit model version, caveats and evidence freshness'] },
  { name:'Noah Williams', role:'Portfolio operator', lens:'Availability and revenue loss', metric:'Avoidable loss $18k', action:'Inspect the inverter cluster driving 61% of lost output', signals:['Select fleet, asset class and operating threshold','Translate availability into production and revenue at risk','Separate sensor evidence from inferred fault labels','Elevate recurrent faults while preserving safety events','Alert only above personal loss or outage thresholds','Compare dispatch, field visit and planned maintenance','Review permissions, work orders and learning history'] },
  { name:'Aisha Bello', role:'Market analyst', lens:'Policy evidence and data lineage', metric:'Source freshness 96%', action:'Add an independent source to one single-source claim', signals:['Choose market, technology and comparison basis','Translate policy language into scope and effective date','Show publisher, original URL, issue date and verification date','Rank trusted publishers but retain contradictory evidence','Alert only on substantive revision or data restatement','Compare base, upside and conservative definitions','Audit citations, dead links and personalization controls'] },
];
const week = [
  ['Set the decision lens', 'The product asks for market, project stage and decision horizon before showing metrics.', 'Preference setup', 'profile-preference-v1', 62],
  ['Translate the economics', 'IRR, DSCR and LCOE are explained in terms of the decision they can change.', 'Plain-language finance', 'plain-language-energy-v2', 69],
  ['Map the evidence path', 'Every material claim exposes publisher, original URL, issue date and latest verification.', 'Evidence provenance', 'rag-provenance-gate-v2', 76],
  ['Learn from signals', 'Saved evidence and dismissed cards alter the next briefing without hiding material risk.', 'Behavior learning', 'ranking-feedback-v1', 81],
  ['Watch material changes', 'Alerts are triggered by personal thresholds rather than generic market movement.', 'Threshold monitoring', 'threshold-monitor-v2', 85],
  ['Compare real options', 'Three actions are compared by cost, delay, reversibility and evidence strength.', 'Scenario comparison', 'scenario-compare-v2', 89],
  ['Audit the week', 'The user can inspect learned preferences, evidence freshness and every personalization control.', 'Evidence audit', 'evidence-audit-v2', 93],
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
      <aside className={`${styles.panel} ${styles.personas}`}>{personas.map((x,i)=><button key={x.name} type="button" aria-pressed={persona===i} aria-label={`${x.name}, ${x.role}, focused on ${x.lens}`} className={`${styles.persona} ${persona===i?styles.active:''}`} onClick={()=>setPersona(i)}><strong>{x.name} · {x.role}</strong>{x.lens}</button>)}</aside>
      <div>
        <div className={styles.days} aria-label="Seven-day personalization journey">{week.map((_,i)=><button key={i} type="button" aria-pressed={day===i} className={`${styles.day} ${day===i?styles.active:''}`} onClick={()=>setDay(i)}>Day {i+1}</button>)}</div>
        <article className={styles.panel} aria-live="polite">
          <div className={styles.top}><div><div className={styles.kicker}>{p.name} · {p.role}</div><h2>{d[0]}</h2><p className={styles.intro} style={{fontSize:15}}>{d[1]}</p><span className={styles.skill}>Active skill: {d[2]} · {d[3]}</span></div><div className={styles.confidence}><strong>{d[4]}%</strong>evidence confidence</div></div>
          <div className={styles.cards}><div className={styles.card}><b>Priority today</b>{p.signals[day]}<span className={styles.metric}>{p.metric}</span></div><div className={styles.card}><b>Reversible next action</b>{p.action}. Pro members can save portfolios, set more thresholds and export sourced Word/PDF reports.</div><div className={styles.card}><b>Evidence gate</b>{day===2?'Claims show publisher, original URL, issue date and 30 Jul 2026 verification date. Single-source claims remain visibly uncorroborated.':'Stale sources are excluded; material claims require publisher, date and traceable URL.'}</div></div>
          <div className={styles.control}>Personalization can be paused, edited or erased. Regulatory, safety and material-risk evidence is never hidden by ranking or membership. This is decision support, not investment, tax or legal advice.</div>
        </article>
      </div>
    </section>
  </div></main>;
}
