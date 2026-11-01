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

## 2026-11-01 补充：国际站币种与席位口径
- 国际站（market=global）币种固定为 **美元（USD）**（负责人 2026-11-01 决定）。只显示 Stripe 实际 Price 里读到的金额，且该 Price 必须是 USD；
  非 USD 的 Price 视为配置错误：定价页不显示金额（显示"结账时展示（USD）"），`create_checkout_session` 直接拒绝下单。
  实现：`app/services/market_localization.py`（`INTERNATIONAL_CURRENCY`）、`app/services/stripe_service.py`；测试：`tests/test_intl_currency_usd_20261101.py`。
  Stripe 后台需把国际站 Price 建为 USD（需要本人在 Stripe 操作，本次没有创建）。
- 席位以注册表 v2.0.0（2026-10-27，依据 0S2）为准：免费 1 / 标准 1 / 专业 3 / 团队 10 / 上限档 10（合同可增加）。
  D5 6-1 在 2026-10-15 的草案写的是团队 5 / 上限档 20，早于 0S2，已作废；该差异按"以较新的决定为准"关闭，并由测试锁定。
- 档名以注册表为准：免费 / 标准·数据库订阅 / 专业 / 团队 / 上限档（英文 Evaluation / Professional / Expert / Team / Enterprise）。
