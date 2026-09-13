# 国内生产镜像公开配置修复

Next.js 浏览器端 NEXT_PUBLIC_* 取自构建时环境。原 Compose 仅在容器启动时提供 Supabase URL/anon key，Dockerfile 没有对应构建参数，可能发布已经包含 placeholder.invalid 的浏览器代码。

本轮将两个公开 Supabase 参数接入国内 Dockerfile、Compose build.args 与 Runtime Production Images 工作流；公开 API 地址也显式传入该工作流。仅国内矩阵使用国内参数，其他镜像不传入国内参数值。镜像构建前验证 HTTPS 地址、拒绝本机/典型占位地址及带凭据 URL；公开 key 只接受 publishable 格式或 role=anon 的 JWT 格式，拒绝 secret/service_role。格式检查不验证签名、有效期、RLS、服务连通或项目归属。

SUPABASE_SERVICE_ROLE_KEY 仍仅在容器运行时作为服务端配置，禁止放入构建参数。构建参数会公开进入浏览器，GitHub 仓库变量 CN_SUPABASE_URL、CN_SUPABASE_ANON_KEY、CN_PUBLIC_API_URL 只应包含公开配置，不能用私钥代替。未配置时国内镜像发布会明确失败，不用假值发布。

环境示例补齐 Compose 所有强制变量（镜像仓库、域名、公开 API、文献联系邮箱、支付宝配置），补充国内模型变量。生产 Compose 检查会阻止以后遗漏必填变量或误将 service role 放入国内 build.args。

验证：9 个纯配置回归场景通过，Compose 6 服务契约检查通过；工作流 YAML 解析与 git diff --check 通过。回归已接入 Runtime Production Images。未启动 Docker daemon、未构建/推送真实生产镜像、未设置真实密钥，也没有向阿里云部署。

剩余代码任务：国内独立 Compose/网关拓扑（当前仍依赖 web-int、INT_DOMAIN），旧 scripts/deploy.sh 的过期构建路径，国内模型选择与存储全链路配置验证。旧 AWS 工作流不代表国内部署。真实域名、备案、证书、ACR 可达性、数据库迁移/备份与真实支付仍要在指定阿里云环境验收。
