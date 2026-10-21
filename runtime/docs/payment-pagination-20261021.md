# 国内会员付款记录分页

基础4d95e9c。当前runtime/web会员中心，不是旧后端或Stripe国际账单。

原/api/membership/me嵌套付款查询固定take20，页面没有后续入口。新增paymentPage（正整数、最大1000000）、每页20条加1条检测下一页；createdAt/id稳定排序，仍按会话用户及其subscription过滤completed付款。返回paymentPagination.nextPage，既有调用默认第一页兼容。

页面加载更多追加记录，按id去重，加载失败保留已有内容并提示重试，加载中禁用按钮；账户ID变化拒绝合并。金额统一显示两位小数。

验证：Jest7项通过，包括45条分三页完整取回、5种非法页码、未登录不查询；TypeScript无错误，diff检查通过。Prisma/身份为替身，不是实际数据库分页或真实账单；页面未执行浏览器截图测试。offset分页在加载期间插入/删除付款可能发生位移，当前去重防重复但不提供快照一致性，后续需游标/刷新验收。不能宣称完整会员或UI验收完成。

阅读runtime/web/AGENTS.md及所要求Next route文档前95行、当前membership/me和会员页；未改他人旧后端RAG工作。下一步真实数据库/浏览器45笔与网络失败场景，随后订单状态/导出验收。

## 同日追加：游标与真实数据库验收

在a784fad上追加paymentCursor，使用createdAt/id边界，当前页面通过nextCursor连续读取；旧paymentPage兼容保留。游标绑定账户并检查格式/长度；不是授权凭证，真实数据仍限定登录用户的subscription。首屏之后的新付款须刷新查看，不把它插入正在读取的旧记录序列。

实际本机PostgreSQL新建energy_integration_test，通过当前Prisma schema db push建立隔离结构（非历史迁移整链）。新增测试创建本人45条相同时间付款及另一用户付款；第一页后删除已显示记录并插入新记录，后续25条全取、无跨用户记录；另一账户重用游标400。旧接口运行同题失败，修复后接口7项+实际PG1项共8项通过，TypeScript通过。测试身份会话仍为替身，数据库查询是真实Prisma/PostgreSQL，无支付渠道调用。测试数据在afterAll清理；空测试数据库保留供后续验证。

这解决记录插入/删除导致的页码位移，不是数据库快照：读取途中更改旧记录的排序字段/状态仍需另行约束或刷新。真实页面点击/网络失败截图尚未执行。GitHub重试仍遇TLS错误，是否同步须以推送结果为准。

推送核验：随后重试成功，GitHub fixes/energy-p0-2026-10-15 已从4d95e9c更新至5875ebe，包含此前未推送的a784fad。
