/**
 * @vitest-environment jsdom
 *
 * Illustrative ITC arithmetic only. These figures are not a determination
 * of eligibility under §48E or §45Y.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import IncentivesPage from '../pages/IncentivesPage';

vi.mock('next/navigation', () => ({
  usePathname: () => '/incentives',
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
});

function rowText(label: string): string {
  const row = screen.getByText(label).parentElement;
  if (!row) throw new Error(`missing row: ${label}`);
  return row.textContent ?? '';
}

describe('ITC illustrative calculator', () => {
  it('estimates $600,000 at 30% on $2,000,000, then $800,000 at 40% with only Domestic Content', () => {
    render(<IncentivesPage />);

    const capex = screen.getByLabelText('Eligible capital expenditure (USD)');
    expect(capex.id).toBe('itc-capex');

    fireEvent.change(capex, { target: { value: '2000000' } });
    expect(rowText('Effective ITC rate')).toContain('30%');
    expect(rowText('Estimated tax credit')).toContain('$600,000');
    expect(rowText('Net capex after credit')).toContain('$1,400,000');

    fireEvent.change(capex, { target: { value: '2,000,000' } });
    expect(rowText('Estimated tax credit')).toContain('$600,000');
    expect(rowText('Net capex after credit')).toContain('$1,400,000');

    const domestic = screen.getByRole('switch', { name: 'Domestic Content Bonus' });
    const energyCommunity = screen.getByRole('switch', { name: 'Energy Community Bonus' });
    const lowIncome = screen.getByRole('switch', { name: 'Low-Income Bonus' });
    const domesticLabel = screen.getByText('Domestic Content Bonus');

    expect(domesticLabel.tagName).toBe('LABEL');
    expect(domesticLabel.getAttribute('for')).toBe(domestic.id);
    expect(domestic.getAttribute('data-testid')).toBe('bonus-domestic-content');
    expect(domestic.tagName).toBe('BUTTON');
    expect(domestic.getAttribute('aria-checked')).toBe('false');
    domestic.focus();
    expect(document.activeElement).toBe(domestic);

    fireEvent.click(domestic);

    expect(domestic.getAttribute('aria-checked')).toBe('true');
    expect(energyCommunity.getAttribute('aria-checked')).toBe('false');
    expect(lowIncome.getAttribute('aria-checked')).toBe('false');
    expect(rowText('Effective ITC rate')).toContain('40%');
    expect(rowText('Estimated tax credit')).toContain('$800,000');
    expect(rowText('Net capex after credit')).toContain('$1,200,000');

    const pageText = document.body.textContent ?? '';
    expect(pageText).toContain('No source is selected as the one that controls.');
    expect(pageText).toContain('It is not investment advice and it is not tax advice.');
    expect(pageText).toContain('The arithmetic does not decide eligibility.');
    expect(pageText).toContain('This is not investment advice.');
  });
});
