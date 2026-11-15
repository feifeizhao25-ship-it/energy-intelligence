import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OfficeExportButtons } from './OfficeExportButtons';

describe('公文导出标签', () => {
    it('按钮标明草稿，并说明还不能当正式公文', () => {
        const html = renderToStaticMarkup(<OfficeExportButtons title="测算结果" rows={[['类型', 'wind']]} />);
        expect(html).toContain('导出公文草稿');
        expect(html).not.toMatch(/导出公文</);
        expect(html).toContain('非正式公文');
        expect(html).toContain('不能当正式公文发出');
    });
});