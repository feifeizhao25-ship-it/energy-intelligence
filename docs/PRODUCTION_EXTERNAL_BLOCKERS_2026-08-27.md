# 新能源国内版生产外部堵点（2026-08-27）

## 已验证的生产事实

生产审计流水线 `33062373688` 通过 AWS OIDC 与 SSM 只读检查了实际服务器：

- 主机剩余约 38 GiB 磁盘、3.2 GiB 可用内存，容量不是当前堵点。
- 服务器只有 `energy-caddy` 一个应用容器。
- `/opt/energy/web` 只挂载为国际版静态文件目录。
- 当前没有国内 Web、API、PostgreSQL、Redis 或生产 Compose。
- 源站 HTML 中存在实际部署提交标记；Cloudflare 公网页面没有该标记。
- `energyiq.tianji-astrology.com` 权威 DNS 已指向 Cloudflare，Cloudflare DNS 记录代理到生产主机。
- `xinnengyuan.ai` 的权威 DNS 当前返回 `NXDOMAIN`。

因此，国际站当前的公网堵点在 Cloudflare 边缘路由；国内站则同时缺少域名委派和完整运行时部署。不能把国际英文静态站直接绑定到国内域名充当国内版。

## 必须由 Cloudflare 账号持有人完成

### 国际站边缘路由

1. Cloudflare → `tianji-astrology.com` → Workers & Pages → Routes。
2. 查找覆盖 `energyiq.tianji-astrology.com/*` 的 Worker Route。
3. 如 Worker 仍指向旧站，更新源站或临时移除该 Route。
4. Rules 中检查 Origin Rules、Redirect Rules、Transform Rules 与 Cache Rules，确认没有把该子域路由到旧 Pages/Worker 项目。
5. Caching → Configuration → 清理 `energyiq.tianji-astrology.com` 缓存。
6. 访问首页源代码，确认包含：

```html
<meta name="energy-release" content="2bebd71b1a0f68e4f4f93a84d700bbae1415a8ac">
```

后续部署会自动把该值更新为当次 Git 提交 SHA，并在 GitHub Actions 中验证公网边缘。

现有 `CLOUDFLARE_DNS_TOKEN` 只有 DNS 权限，调用缓存清理和 Worker Route API 会返回权限错误。若希望流水线自动验收和清缓存，请创建最小权限 Token：

- Zone / DNS / Edit
- Zone / Cache Purge / Purge
- Zone / Workers Routes / Read

不要提交 Token 到 Git；存入 GitHub Actions Secret。

### 国内域名

1. 在域名注册商确认 `xinnengyuan.ai` 已购买且未过期；若未购买，先完成购买。
2. 在 Cloudflare 添加 `xinnengyuan.ai` Zone。
3. 将注册商 Nameserver 改成 Cloudflare 分配的两条 NS。
4. 等待以下命令不再返回 NXDOMAIN：

```bash
curl -H 'accept: application/dns-json' \
  'https://cloudflare-dns.com/dns-query?name=xinnengyuan.ai&type=A'
```

5. 国内运行时部署完成后再创建代理记录；不要提前把根域指向英文静态站。

## 国内运行时上线前必须配置

仓库 `runtime/docker-compose.production.yml` 已定义国内 Web、国际 Web、API、PostgreSQL、Redis 与 Caddy，但生产服务器尚未安装该运行时。账号持有人需提供或确认以下生产配置，实际值只进入服务器 Secret Store/GitHub Secrets：

- `POSTGRES_PASSWORD`、`REDIS_PASSWORD`、`SECRET_KEY`
- `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`
- `OPENALEX_CONTACT_EMAIL`
- `CORS_ORIGINS`、`CN_PUBLIC_API_URL`、`CN_NEXTAUTH_URL`
- `CN_DOMAIN=xinnengyuan.ai`
- `INT_DOMAIN=energyiq.tianji-astrology.com`
- 至少一个国内直连 AI Provider Key：DashScope、DeepSeek 或智谱；国内用户不得走 OpenRouter
- `OPENROUTER_API_KEY` 只用于国际版用户，服务端按已认证用户的 `market` 字段隔离路由
- 收款启用前的 Stripe/国内支付正式商户配置与 Webhook Secret

生产切换顺序：

1. 完成域名购买、备案/合规判断和 DNS 委派。
2. 配置以上 Secrets。
3. 发布不可变 API、国内 Web、国际 Web 镜像。
4. 在服务器安装 Compose 与只读运行时配置。
5. 先用临时内部域名验收国内版。
6. 验收登录、会员、支付回调、Skills/RAG 来源、报告导出和移动端关键路径。
7. 最后切换 `xinnengyuan.ai` DNS。

## 验收标准

- 国内站 `<html lang="zh-CN">`，用户可见产品内容全部中文。
- 国际站 `<html lang="en">`，用户可见产品内容全部英文。
- 两个站点不是简单互译：首页信息架构、价格表达、合规提示与重点指标分别适配目标市场。
- API `/health` 同时验证数据库与 Redis，不能只返回静态 `ok`。
- 390×844、320×568 无横向溢出。
- 会员权益与服务端授权一致，不能只在前端隐藏按钮。
- RAG 输出携带来源、发布日期、抓取时间、适用地区和置信度；过期来源被门禁阻止。
- PDF/DOCX 报告经过分页、目录、图表、引用与中英文排版验收。
- 支付成功必须由已验签 Webhook 驱动，不能由前端跳转页面自行开通权益。
