import CheckoutClient from './checkout-client';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** 服务端读取 plan/billing 并直接渲染中文结算页。结算按钮文案是支付宝支付。 */
export default async function CheckoutPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return <CheckoutClient planParam={first(params.plan)} billingParam={first(params.billing)} />;
}
