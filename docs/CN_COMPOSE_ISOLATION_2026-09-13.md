# 国内独立 Compose 拓扑

新增 runtime/docker-compose.cn.production.yml 与 runtime/Caddyfile.cn。国内配置只包含 postgres、redis、backend、web-cn、gateway 五个服务，不再要求 INT_DOMAIN 或启动 web-int。网关仅配置 CN_DOMAIN，并保留 HTTPS、响应安全头和 web-cn 健康依赖。

国内 backend 不再注入 OpenAI、Anthropic、OpenRouter、Stripe、SendGrid 凭据；保留已有的国内模型变量、支付宝与数据库配置。这只证明此编排的凭据/服务隔离，不能证明应用所有 API、资料来源、向量库或供应商都在中国境内。NASA 等资料访问、Supabase 托管位置、后端模型路由仍需独立核验。

配置由 scripts/render_cn_compose.py 从现有主拓扑生成，修改主配置后应重新生成并审核。--check 会检测国内拓扑或网关漂移；Runtime Production Images 工作流已加入检查与测试。

## 验证

5 项回归通过，覆盖主配置不被修改、国内服务集合、国际变量移除、TLS/健康依赖、国内配置保留及实际 docker-compose config --quiet 解析。解析使用合成占位值且不提供 INT_DOMAIN，也不读取真实环境文件；不访问 Docker daemon、不创建容器、不读取或迁移用户数据。原六服务 Compose 契约检查仍通过。

## 在阿里云主机上的待验收步骤

先配置 Docker Engine 与 Compose、域名及证书条件、可访问镜像仓库、真实数据库/支付/模型参数，并完成备份计划。国内编排入口为 runtime/docker-compose.cn.production.yml；可用命令形式如下，环境文件必须是运营方准备的真实文件：

```sh
docker compose --env-file /secure/energy-cn.env -f runtime/docker-compose.cn.production.yml config --quiet
docker compose --env-file /secure/energy-cn.env -f runtime/docker-compose.cn.production.yml pull
docker compose --env-file /secure/energy-cn.env -f runtime/docker-compose.cn.production.yml up -d --wait
```

当前主机只有 docker-compose 独立命令时，可用 docker-compose 替换上述 docker compose。这些命令本轮没有执行。镜像必须使用已验证的固定标签；公开网页参数必须与镜像构建时一致，修改后须重建镜像。首次部署会按已有容器入口执行迁移，生产操作前须检查实际迁移脚本和备份/回滚能力。

项目名设为 energy-intelligence-cn，默认卷名因此与旧混合编排不同。现有生产数据不会自动迁移；禁止直接切换项目名后把空库误认为旧数据丢失，也不要通过删除旧卷解决。已有部署必须先盘点、备份并制定显式数据迁移或卷映射方案。

阿里云 ACR 镜像同步、生产数据库并发、真实证书、登录、支付回调、恢复演练与告警仍未验收。旧 scripts/deploy.sh 仍引用过时路径，不作为此国内配置的部署入口。
