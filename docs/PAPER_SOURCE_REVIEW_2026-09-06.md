# 文献数据源修复记录（2026-09-06）

本次修复国内 runtime/web 的 OpenAlex PDF 字段、可选服务端 API 密钥、10 秒请求超时、损坏响应识别，以及多源合并修改缓存数组的问题。

依据：
- https://help.openalex.org/api/authentication/ （页面更新 2026-08-19）：支持 Authorization Bearer，匿名基本查询仍可用。因此不将旧公告中的“必须有密钥”当作当前事实，也不再因缺少联系邮箱阻止生产请求。
- https://help.openalex.org/data/locations/ （页面更新 2026-08-17）：PDF 位于 best_oa_location.pdf_url，且需确认该位置 is_oa。

验证：2 个测试套件共 5 项通过；TypeScript 无错误。数据源响应使用契约样例，尚未验收生产密钥和真实在线查询。

未完成：跨源年份与开放获取筛选一致性、分页与去重总数、arXiv XML 解析、未知年份/引用数表示、国内输出语言隔离及真实用户页面。以上不得视为已修复。
