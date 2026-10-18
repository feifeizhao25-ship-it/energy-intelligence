# 新能源智库计费规则（2026-10-18 定稿）

唯一计价源：`runtime/backend/data/entitlements.json`（五档年付：免费 / ¥1,980 / ¥5,800 / ¥16,800 / ¥33,000）。月付已彻底废止：注册表 monthly_cny 为 0，后端取价、升级接口、结算页均拒绝月付订单。运维版（maintenance）已停售，仅存量用户保留到期。

## 续费
- 到期按当前档位年付价续费。
- 未到期续费：从现到期日顺延 1 年；已过期：从付款成功日起算 1 年。
- 接口：`POST /api/v1/billing/renewal/quote` 只出测算（金额+新到期日），不扣款。

## 降级
- 降级不立即生效：登记待生效意图，于当前周期结束时切换到目标档位；周期内权益不变，不退差价。
- 接口：`POST /api/v1/billing/downgrade` 将意图记入用户记录（scheduled）；到期扫描用 `billing_rules.apply_scheduled_downgrade` 执行切换。升级不走此接口。

## 退款
- 未使用部分按比例退：应退 = 实付 × 剩余天数 / 周期总天数，向下取整到分；周期未开始全额，周期已结束不退。
- 接口：`POST /api/v1/billing/refund/quote` 只出测算（quote_only）。实际退款由财务在支付渠道后台人工执行并回填交易号，系统不自动出款。

## 未接通道声明
以上均为规则与接口逻辑，未接入任何真实支付/退款通道；支付宝/Stripe 的下单与回调仍是原有代码，未在本定稿中启用新通道。

规则实现：`runtime/backend/app/services/billing_rules.py`，测试：`tests/test_billing_rules.py`。
