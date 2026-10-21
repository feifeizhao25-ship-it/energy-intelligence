# 国内会员付款记录分页

基础4d95e9c。当前runtime/web会员中心，不是旧后端或Stripe国际账单。

原/api/membership/me嵌套付款查询固定take20，页面没有后续入口。新增paymentPage（正整数、最大1000000）、每页20条加1条检测下一页；createdAt/id稳定排序，仍按会话用户及其subscription过滤completed付款。返回paymentPagination.nextPage，既有调用默认第一页兼容。

页面加载更多追加记录，按id去重，加载失败保留已有内容并提示重试，加载中禁用按钮；账户ID变化拒绝合并。金额统一显示两位小数。

验证：Jest7项通过，包括45条分三页完整取回、5种非法页码、未登录不查询；TypeScript无错误，diff检查通过。Prisma/身份为替身，不是实际数据库分页或真实账单；页面未执行浏览器截图测试。offset分页在加载期间插入/删除付款可能发生位移，当前去重防重复但不提供快照一致性，后续需游标/刷新验收。不能宣称完整会员或UI验收完成。

阅读runtime/web/AGENTS.md及所要求Next route文档前95行、当前membership/me和会员页；未改他人旧后端RAG工作。下一步真实数据库/浏览器45笔与网络失败场景，随后订单状态/导出验收。
