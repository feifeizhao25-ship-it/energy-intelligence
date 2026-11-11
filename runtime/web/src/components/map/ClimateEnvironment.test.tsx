import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClimateEnvironment, climateReading } from './ClimateEnvironment';

describe('气候面板缺测', () => {
    it('降水和湿度没有数值时显示暂无数据，不写成 0', () => {
        expect(climateReading(null, 'mm')).toBe('暂无数据');
        expect(climateReading(undefined, '%')).toBe('暂无数据');
        expect(climateReading(0, 'mm')).toBe('0mm');
        const html = renderToStaticMarkup(
            <ClimateEnvironment annual={{ temperature: 6.8, precipitation: null, humidity: null }} />,
        );
        expect(html).toContain('6.8°C');
        expect(html).toContain('年降水');
        expect(html).toContain('湿度');
        expect(html.match(/暂无数据/g)).toHaveLength(2);
        expect(html).not.toContain('0mm');
        expect(html).not.toContain('0%');
    });
});
