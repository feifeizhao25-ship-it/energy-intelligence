import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SignupSourcePicker, { parseSignupSourceOptions, selectedSignupSource } from './signup-source-picker';
import { publicSignupSourceOptions, SIGNUP_SOURCE_FLAG } from '@/lib/growth/signup-source';

const ON = { APP_EDITION: 'cn', [SIGNUP_SOURCE_FLAG]: '1' };

describe('引导页注册来源题', () => {
    it('开关关闭（enabled=false）或接口回了别的东西：没有选项，整块不渲染', () => {
        expect(parseSignupSourceOptions(publicSignupSourceOptions({}))).toEqual([]);
        expect(parseSignupSourceOptions(null)).toEqual([]);
        expect(parseSignupSourceOptions({ enabled: true, options: 'x' })).toEqual([]);
        expect(renderToStaticMarkup(<SignupSourcePicker options={[]} value="" onChange={() => {}} />)).toBe('');
    });

    it('开关打开：九个单选按钮，标明选填可跳过，没有输入框', () => {
        const options = parseSignupSourceOptions(publicSignupSourceOptions(ON));
        const html = renderToStaticMarkup(<SignupSourcePicker options={options} value="friend" onChange={() => {}} />);
        expect(html).toContain('从哪知道我们（选填，可跳过）');
        expect(html.match(/role="radio"/g)).toHaveLength(9);
        expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
        expect(html).not.toMatch(/<input|<textarea/);
        for (const label of ['小红书', '抖音', '视频号', '公众号', '知乎', '哔哩哔哩', '搜索', '朋友推荐', '其他']) {
            expect(html).toContain(label);
        }
    });

    it('只提交在选项里的代码，未选即跳过', () => {
        const options = parseSignupSourceOptions(publicSignupSourceOptions(ON));
        expect(selectedSignupSource(options, 'douyin')).toBe('douyin');
        expect(selectedSignupSource(options, '')).toBeUndefined();
        expect(selectedSignupSource(options, 'tiktok')).toBeUndefined();
        expect(selectedSignupSource([], 'douyin')).toBeUndefined();
    });
});
