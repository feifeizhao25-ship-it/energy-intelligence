import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CheckoutClient from '@/app/(dashboard)/checkout/checkout-client';
import { licenseGrantedFromEnv, paidCheckoutOpen } from '@/lib/membership/trial';

describe('经营许可未取得时收费入口关闭', () => {
    it('未设置许可标志时关闭，只有明确授予才打开', () => {
        expect(paidCheckoutOpen(false)).toBe(false);
        expect(paidCheckoutOpen(true)).toBe(true);
        expect(licenseGrantedFromEnv({})).toBe(false);
        expect(licenseGrantedFromEnv({ BUSINESS_LICENSE_GRANTED: '' })).toBe(false);
        expect(licenseGrantedFromEnv({ BUSINESS_LICENSE_GRANTED: '0' })).toBe(false);
        expect(licenseGrantedFromEnv({ BUSINESS_LICENSE_GRANTED: '1' })).toBe(true);
        expect(licenseGrantedFromEnv({ BUSINESS_LICENSE_GRANTED: 'granted' })).toBe(true);
    });

    it('结算页在关闭时不渲染支付按钮，打开时才渲染', () => {
        const closed = renderToStaticMarkup(createElement(CheckoutClient, { planParam: 'PRO', checkoutOpen: false }));
        expect(closed).toContain('经营许可未取得，收费入口关闭');
        expect(closed).not.toContain('支付宝支付');
        expect(closed).not.toContain('微信扫码支付');
        const open = renderToStaticMarkup(createElement(CheckoutClient, { planParam: 'PRO', checkoutOpen: true }));
        expect(open).toContain('支付宝支付');
        expect(open).toContain('微信扫码支付');
        expect(open).not.toContain('经营许可未取得，收费入口关闭');
    });

    it('结算页和升级接口都会调用 paidCheckoutOpen', () => {
        const page = readFileSync(join(__dirname, '../../app/(dashboard)/checkout/page.tsx'), 'utf8');
        const route = readFileSync(join(__dirname, '../../app/api/membership/upgrade/route.ts'), 'utf8');
        expect(page).toContain('paidCheckoutOpen(licenseGrantedFromEnv())');
        expect(route).toContain('paidCheckoutOpen(licenseGrantedFromEnv())');
    });
});
