import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

let params = new URLSearchParams();
jest.mock('next/navigation', () => ({ useSearchParams: () => params }));

import ReportPage, { readCoordinate } from './ReportPage';

describe('资源报告未选点', () => {
    it('直接打开 /map/report 时引导去地图选点，而不是报无效坐标', () => {
        expect(readCoordinate(null, 90)).toBeNull();
        expect(readCoordinate('', 90)).toBeNull();
        expect(readCoordinate('0', 90)).toBe(0);
        params = new URLSearchParams();
        const html = renderToStaticMarkup(<ReportPage />);
        expect(html).toContain('还没有地图选点');
        expect(html).toContain('去地图选点');
        expect(html).toContain('href="/map"');
        expect(html).not.toContain('无效的坐标参数');
    });
});
