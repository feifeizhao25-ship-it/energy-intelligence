import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SolarPage from '@/app/(dashboard)/calculator/solar/page';

test('server-rendered form cannot submit before hydration or claim saved output', () => {
    const html = renderToStaticMarkup(<SolarPage />);
    expect(html).toMatch(/<button disabled=""[^>]*>正在准备表单…<\/button>/);
    expect(html).not.toContain('初步估算已保存');
    expect(html).not.toContain('name="loanRatio"');
});
