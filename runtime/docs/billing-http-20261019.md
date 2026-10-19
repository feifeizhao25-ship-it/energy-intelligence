# 现行计费接口持久化验证与到期续费修复

接续 billing-boundaries-20261019.md，基于f410a5c。现行runtime应用（非遗留后端）真实HTTP测试发现已到期pro账户读取user.plan时变free，price_for返回400，无法获得续费报价。改为按持久化subscription_plan报价，不修改有效权益、订阅或有效期。

新增脚本 runtime/backend/scripts/verify_billing_rules.py 使用独立临时cwd/SQLite、白名单环境和本地测试密钥，避免加载工作区.env。加载完整app/conftest，使用真实JWT、SQLAlchemy数据库和HTTP请求，不覆盖身份依赖。测试模型/支付服务没有调用；报价不付款。

修复前1失败24通过，失败为已到期用户报价400；修复后加免费用户和原到期权益回归共29通过（3项第三方警告）。验证内容：活跃/到期购买档位报价、报价不恢复权益、免费用户拒绝、无登录拒绝、四种非法退款金额HTTP400、降级意图在新数据库会话读取一致且原权益保持、月份/闰年及到期权益。日志在runtime/docs/evidence/2026-10-19-billing-http/。

复现：`/tmp/energy-rag-20261017/bin/python runtime/backend/scripts/verify_billing_rules.py`（本机Python3.11已有依赖环境；不是目标容器锁定依赖验证）。临时库退出自动清理。没有生产部署或真实付款。

未完成：检索app下apply_scheduled_downgrade仅定义，没有调用任务；HTTP登记成功并不证明到期切换执行。新报价仍由用户提供测算参数，不等同订单可退金额核验；真实退款及商户验收尚无证据。无新增UI截图。其他未提交RAG改动保留。
