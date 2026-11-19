# 国内版全站只读周漏斗（GET /api/growth/funnel/weekly）

只读、只出全站合计、不出任何身份信息。用于每周看注册 → 付费 → 续费/到期的大盘。

## 怎么开、怎么关

| 项 | 说明 |
|---|---|
| 服务 | `web-cn`（Next.js，库 `energy_web`）。国内 Caddy 把除企微回调外的路径都交给 web-cn，所以对外地址是 `https://<国内域名>/api/growth/funnel/weekly`。 |
| 令牌变量 | `ENERGY_FUNNEL_READONLY_TOKEN`。**默认不设 = 入口关闭**，返回 503。 |
| 生成令牌 | 单独生成一串随机值（例如 `openssl rand -hex 32`），只放在服务器环境里。**不要复用** `NENGJIAN_INTERNAL_TOKEN`、`CRON_SECRET`、`NEXTAUTH_SECRET`、`CORE_API_KEY` 或任何管理口令：如果配置值和这些变量相同，代码按"未开启"处理。 |
| 调用 | `curl -H "Authorization: Bearer $ENERGY_FUNNEL_READONLY_TOKEN" "https://<国内域名>/api/growth/funnel/weekly?weeks=4"` |
| 作用范围 | 这个令牌只被这一个接口读取，别的接口不认它；这个接口也不认登录会话、查询参数里的令牌或其他口令。 |
| 关闭 | 把变量清空或删掉，重启 web-cn。 |

Compose：`scripts/render_cn_compose.py` 给 web-cn 加了 `ENERGY_FUNNEL_READONLY_TOKEN: ${ENERGY_FUNNEL_READONLY_TOKEN:-}`，`runtime/docker-compose.cn.production.yml` 是重新生成的（只多这一行）。变量名也写进了 `runtime/.env.production.example`（值留空）。

## 参数

| 参数 | 默认 | 说明 |
|---|---|---|
| `week_start` | 本周 | 要看的**最近一周**的周日，格式 `YYYY-MM-DD`（上海日期）。不是周日、格式不对、晚于本周 → 422。 |
| `weeks` | 4 | 从 `week_start` 往前共几周，1–26。 |

## 返回码

| 状态 | 场景 |
|---|---|
| 200 | 正常 |
| 401 | 令牌缺失或不对（`只读令牌无效`） |
| 405 | 非 GET（只导出了 GET） |
| 422 | 参数不对，在查库之前就拒绝 |
| 503 | 入口未开启（`只读入口未开启`），或查库失败（`数据暂不可用，请稍后再试`，不回显错误详情） |

所有响应都带 `Cache-Control: no-store`。

## 口径

- **周**：上海时间（UTC+8）周日 00:00:00 至周六 23:59:59。查询用半开区间 `[周日 00:00, 下周日 00:00)`。本周 `complete: false`。
- **金额**：单位**分**（整数），币种 CNY。`payments.amount` 是元（Decimal(12,2)），按字符串换算成分，不走浮点。
- **new_signups**：`users.createdAt` 落在本周的人数。短信验证码首次登录即建号。已注销的账号（匿名化保留、有 `deletedAt`）仍按建号时间计入。
- **new_paid**：本周有"这个用户第一次付款成功"的人数（`payments.status = completed`、`currency = CNY`、按 `paidAt`），按用户去重。
- **renewals**：本周付款成功、且这个用户此前已经付过款的**订单数**（续费、换档再付款都算）。
- **order_amount_fen**：本周付款成功的 CNY 订单金额合计，未扣退款。人工把订单改成 `refunded` 的，会从这里消失（不再是 completed）。
- **refund_amount_fen**：**null**。代码里没有任何地方把订单改成 `refunded`，`payments` 也没有退款时间字段；退款目前只有测算（`/api/membership/refund/quote`）和人工处理。没有数据源，所以不给数。
- **expirations**：`subscriptions.endDate` 落在本周、且已经过去的订阅数。每个用户只有一条订阅，续费会把到期日往后推，所以"过去某周到期后又续上"的人看不到——**过去的周是下限**。代码里订阅状态一直是 ACTIVE（没有写 EXPIRED/CANCELLED 的地方），所以按到期日算，不按状态。
- **signups_by_source**：来源表 `signup_source_events`（#173，未合入）**不存在时为 null**，并在 `field_notes` 里说明，不是 0。表存在时，按本周注册的人统计 `{来源码: 人数, ..., unanswered: 没填的人数}`。
- **不含**：后端 FastAPI 自己的库 `energy_api`（有另一套 users/payment_orders）。它不对公网开放，这个接口不读它。App 端如果走后端账号/支付，就不在这张表里（见 PR 里的说明）。

## 安全

- 只返回全站合计，没有用户 ID、手机号、邮箱、订单号。代码里付款用户 ID 只在内存里做 sha256 去重，不出接口。
- 查询在 `SET TRANSACTION READ ONLY` 的事务里执行，并设 `statement_timeout = 5000ms`；只选需要的列（payments 只取 id/userId/amount/paidAt，subscriptions 只取 endDate）。
- 令牌比对用 sha256 + `timingSafeEqual`。

## 返回示例

下面是在测试库（PostgreSQL 16，假数据）上调真实路由拿到的结果（`week_start=2026-11-15&weeks=2`，此时 #173 的表不存在）：

```json
{
  "scope": "site",
  "market": "cn",
  "timezone": "Asia/Shanghai",
  "week_definition": "上海时间（UTC+8）周日 00:00:00 至周六 23:59:59",
  "currency": "CNY",
  "money_unit": "分",
  "generated_at": "2026-11-19T05:11:12+08:00",
  "weeks": [
    {
      "week_start": "2026-11-08T00:00:00+08:00",
      "week_end": "2026-11-14T23:59:59+08:00",
      "complete": true,
      "new_signups": 2,
      "new_paid": 2,
      "renewals": 1,
      "order_amount_fen": 27705,
      "refund_amount_fen": null,
      "expirations": 2,
      "signups_by_source": null
    },
    {
      "week_start": "2026-11-15T00:00:00+08:00",
      "week_end": "2026-11-21T23:59:59+08:00",
      "complete": false,
      "new_signups": 2,
      "new_paid": 1,
      "renewals": 1,
      "order_amount_fen": 22900,
      "refund_amount_fen": null,
      "expirations": 2,
      "signups_by_source": null
    }
  ],
  "field_notes": {
    "new_signups": "users 表按 createdAt 计：短信验证码首次登录即建号。已注销（匿名化保留）的账号仍按建号时间计入。",
    "new_paid": "本周第一次付款成功（payments.status = completed，CNY）的用户数，按用户去重。",
    "renewals": "本周付款成功、且此前已经付过款的订单数（续费、换档再付款都算）。",
    "order_amount_fen": "本周付款成功的 CNY 订单金额合计，单位分（payments.amount 元 × 100），未扣退款。",
    "refund_amount_fen": "暂无数据：代码里没有任何地方把订单改成 refunded，payments 也没有退款时间字段；退款目前只有测算（/api/membership/refund/quote）和人工处理。",
    "expirations": "订阅到期日（subscriptions.endDate）落在本周且已经过去的订阅数。每个用户只有一条订阅、续费会把到期日往后推，所以过去某周到期后又续上的人看不到，过去的周是下限。",
    "signups_by_source": "暂无数据：注册来源表 signup_source_events 不存在（#173 未合入或未迁移），不是 0。"
  }
}
```
