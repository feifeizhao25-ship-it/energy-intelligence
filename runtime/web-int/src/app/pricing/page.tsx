import type { Metadata } from 'next';
import Link from 'next/link';
import { resolveInternationalPrice } from '../../lib/international-price';

export const metadata: Metadata = {
  title: 'Pricing · Energy Intelligence Global',
  description: 'Five plans for evidence-led renewable energy decisions, from a free evaluation to enterprise agreements.',
};

const tiers = [
  { id: 'free', name: 'Evaluation', period: 'no card required', tagline: 'Try one project workflow.', features: ['5 AI interactions per day', '3 resource queries and calculations per day', '1 active project', '3 watermarked PDF exports per month', '7-day data retention'], cta: 'Start free', href: '/assessment' },
  { id: 'pro', name: 'Professional', period: 'per year', tagline: 'For individual analysts and project owners.', features: ['100 AI interactions per day', 'Unlimited resource queries and calculations (fair use)', 'Up to 30 projects', '30 PDF and Word exports per month', '1-year data retention'], cta: 'Start assessment', href: '/assessment' },
  { id: 'full', name: 'Expert', period: 'per year', tagline: 'For senior analysts, O&M managers and consultants.', features: ['Everything in Professional', '300 AI interactions per day', 'O&M diagnosis, up to 50 stations', 'Up to 200 projects', 'Unlimited PDF and Word exports', '2-year data retention'], cta: 'Start assessment', href: '/assessment' },
  { id: 'team', name: 'Team', period: 'per year', tagline: 'For a ten-person project or advisory team.', features: ['Everything in Expert', '10 team seats', '1,500 shared AI interactions per day', 'Up to 500 shared projects', '3-year data retention'], cta: 'Contact sales', href: 'mailto:sales@aurenix-ai.com' },
  { id: 'enterprise', name: 'Enterprise', period: 'per year', tagline: 'For organizations with governed rollouts.', features: ['10 seats included, more by contract', 'API, SSO, and white-label options', 'Contract-defined scale and retention', 'Private deployment assessment'], cta: 'Contact sales', href: 'mailto:sales@aurenix-ai.com' },
];

export default async function Pricing() {
  const priced = await Promise.all(tiers.map(async (tier) => ({
    ...tier,
    price: await resolveInternationalPrice(tier.id),
  })));
  return (
    <main className="shell">
      <div className="eyebrow">Pricing</div>
      <h1>Pay for decisions you can defend.</h1>
      <p>Every plan keeps assumptions, source dates, and confidence notes visible. International prices are annual and in US dollars. The amount is the configured Stripe Price, or a USD amount on the registry. A plan with neither shows price unavailable.</p>
      <div className="grid pricing-grid">
        {priced.map((tier) => (
          <article className="card plan" key={tier.name}>
            <h2>{tier.name}</h2>
            <div className="metric">{tier.price}</div>
            <p className="period">{tier.period}</p>
            <p>{tier.tagline}</p>
            <ul>{tier.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
            {tier.href.startsWith('mailto:')
              ? <a className="button secondary" href={tier.href}>{tier.cta}</a>
              : <Link className="button secondary" href={tier.href}>{tier.cta}</Link>}
          </article>
        ))}
      </div>
      <section>
        <h2>Checkout</h2>
        <p>Checkout charges the same US dollar Stripe Price shown above. Tax is calculated by Stripe at checkout and is not added here. If a plan says price unavailable, that plan cannot be checked out.</p>
        <ul>
          {priced.filter((tier) => tier.id !== 'free').map((tier) => (
            <li key={tier.id}>{tier.name}: {tier.price}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Before you buy</h2>
        <div className="grid">
          <article className="card"><h3>Assumptions stay visible</h3><p>No plan hides the inputs behind a result. Reviewers see the same evidence you do.</p></article>
          <article className="card"><h3>Human review required</h3><p>Screening outputs support, not replace, bankable measurement and engineering judgment.</p></article>
          <article className="card"><h3>Export formats</h3><p>PDF and Word export are available today. Other formats are not included in any plan until they are released.</p></article>
        </div>
      </section>
    </main>
  );
}
