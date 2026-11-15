import CheckoutClient from './checkout-client';
import { licenseGrantedFromEnv, paidCheckoutOpen } from '@/lib/membership/trial';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** 服务端读取 plan/billing 并直接渲染中文结算页。经营许可未设置时不渲染支付按钮。 */
export default async function CheckoutPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const checkoutOpen = paidCheckoutOpen(licenseGrantedFromEnv());
  return <CheckoutClient planParam={first(params.plan)} billingParam={first(params.billing)} checkoutOpen={checkoutOpen} />;
}
