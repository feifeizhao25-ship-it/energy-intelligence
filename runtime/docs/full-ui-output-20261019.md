# 真实UI：完整输出与会员权益（2026-10-19）

本轮在8ca0195基础上运行本地真实Next.js网页。国内站3411连接新建PostgreSQL energy_ui_evidence_20261019（非生产库）；会员档位及验证码为测试种子，经真实NextAuth接口登录；浏览器真实点击并读取计算接口。没有响应替身、真实付款或短信下发。国际站3412独立英文应用，估算在浏览器执行，无API输出，不伪装模型结果。

## 已修复、已验证

- 国内储能API返回的假设、净现值、技术参数、敏感性区间、11行现金流原先未完整显示。现在按结论、假设、区间、年度现金流组织并全部展示，无折叠或裁切；区间明确不是保证收益或统计置信区间。
- 国际估算页风电/储能选项原先不改变光伏计算：暂不支持的选项明确禁用，避免错报。并未实现风电/储能计算。
- 国际空值、零/负容量、越界纬度不再显示无效发电量；英文提示引导修正，明确默认值为示例、没有实时数据获取或项目保存。

## 证据

修复前国内35条、国际43条；修复后国内35条、国际46条；另5个会员中心，另有会员边界修复前后6条，合计170条当前运行截图/全文/API记录。全量本地证据：/Users/feifei00/Documents/四项目UI完整证据-20261019，current.html可浏览；本目录仅归档3张代表原图，不能据此替代全量记录。

国内5种档位为FREE、MAINTENANCE、FULL、TEAM、ENTERPRISE，每个用户7次同日参数递进：31次成功、4次免费额度用尽429。成功结果逐一断言API全部假设出现在DOM、现金流表格行数等于API数组长度，净现值与区间章节存在。5个会员中心API档位与数据库一致，已用测算次数分别3、7、7、7、7；实际会员UI已采集。尚未全面验证PRO、到期、降级、退款、团队权限和宣传权益全矩阵。

国际5个地区参数角色的35个输入状态，加无效输入和公共路由；修复后46条，无页面级横向溢出。DOM确认unsupported options disabled；无效输入告警可见且数值结果不存在。浏览器旧版本Playwright isDisabled不识别option，改直接检查标准DOM disabled属性；告警断言限定结果区域，避免Next路由播报器干扰。未削弱产品验证。

国内修复后35条同样无页面级横向溢出。查看手机/桌面代表原图；捕获滚动回顶部改为instant，避免smooth scrolling让固定导航出现在长截图中间。原始业务UI未为截图隐藏或篡改。

两站TypeScript无错误。此次为开发服务器实际网页，不是生产构建、原生真机或生产验收。七步参数输入不是七天登录；没有证明个性化留存。未新增音视频播放或PDF/Word导出通过证据。

## 复现

脚本在 runtime/scripts/ui-evidence/。本机使用 /Users/feifei00/Documents/scripts/ui-shots/node_modules/playwright/index.mjs 及系统Chrome；通过PLAYWRIGHT_MODULE指定该模块，或安装根package.json已声明的playwright依赖。不要将种子脚本改为生产数据库：脚本固定localhost专用库，删除并重建仅ui-N@example.invalid测试用户。

1. 独立建库energy_ui_evidence_20261019，用runtime/web/src/prisma/schema.prisma执行prisma db push并生成客户端；这是测试建库，非生产迁移验收。
2. 国内Next服务端指定该DATABASE_URL、DIRECT_URL、NEXTAUTH_URL=http://127.0.0.1:3411及本地测试NEXTAUTH_SECRET；国际端运行3412。
3. UI_CAPTURE_PHASE=after-energy-cn UI_ASSERT_COMPLETE=1 node runtime/scripts/ui-evidence/energy-cn-complete.mjs。
4. node runtime/scripts/ui-evidence/energy-membership-complete.mjs（核对上一步用量）。
5. UI_CAPTURE_PHASE=after-energy-global UI_ASSERT_COMPLETE=1 node runtime/scripts/ui-evidence/energy-global-complete.mjs。

## 待接续

优先分发侠国际生成401/503链、国内会员各档真实生成/导出/发布权限；顺时完整对话到页面和音频；见己保持冻结下核查国内会员/国际缺失场景。当前只有新能源新增修复，其他三产品不能因历史截图存在而宣称通过。历史977条证据已生成全文总览并逐文件核查存在；历史缺陷是否已被Claude修复须对当前版本重测，不能直接重复修改。

仍需：全功能路由清单与动作覆盖、七天持久化、会员到期/付款/退款/降级链、国内外语言及文化规则、Skill/RAG事实核验、音视频、报告导出、发布构建。服务器与商户凭据为外部门禁，不影响继续代码工作。

## 会员边界追加修复

本轮实际页面复现：无固定到期日的FULL用户服务端允许使用，但页面显示已到期免费；昨天使用量在新的一天仍显示旧值。修复前3场景：2失败、1正确到期回退；修复后3项均通过，真实API与页面截图保存于before/after-membership-boundaries。

会员接口现在返回统一effectivePlan和nextResetAt；页面不再用自己的不同规则判断到期。无固定到期日沿用现有服务端规则，不新增永久会员承诺。按北京时间新一天显示零用量，仅调整查询结果，不在读接口写数据库，实际原子扣减保持原有逻辑。实际到期仍降为免费，未放松权限。

会员day/daily-usage/plans-5tiers专项14项通过，两站TypeScript检查通过。新增会员查询字段和UI已在独立数据库/浏览器复验；不代表全会员生命周期或生产支付已完成。

收尾：本轮产品临时服务已停止，专用PostgreSQL库已删除；完整证据浏览器服务3420保留。原始界面不因截图修改；种子档位、验证码、额度测试均不涉及生产。另记录待办：会员付款历史目前API最多返回20条，尚无完整分页，此项不能算“全部历史完整展示”通过。
