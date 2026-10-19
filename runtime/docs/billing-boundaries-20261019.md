# 计费测算边界修复

接续 billing-rules-20261018.md，基线013236d。当前范围为 runtime/backend；旧“后端”目录的历史83项RAG测试不作为现行后端验收。

修复：续费、降级、退款比较前统一UTC，数据库无时区时间按UTC处理，避免 naive/aware TypeError。金额统一验证有限、正数、最多两位小数；NaN/Infinity/文本/过大Decimal及小数精度错误产生ValueError，供现有HTTP映射400；全额退款也格式化到分。既有未使用天数向下取整规则未变，不接真实支付。

先补独立反例：修复前9失败6通过；修复后15通过。命令：`PYTHONPATH=runtime/backend /tmp/energy-rag-20261017/bin/python -m pytest --noconftest -c /dev/null runtime/backend/tests/test_billing_rules.py -q`。显式独立规则函数测试，不加载应用conftest/数据库/.env；不是HTTP、数据库到账、真实退款或完整应用验收。日志在 runtime/docs/evidence/2026-10-19-billing/。

后续仍需新API端到端、降级到期任务实际调用、退款订单金额真实性绑定和支付商户验收。其他未提交RAG修改保留；没有部署和付款。
