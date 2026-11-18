# 新能源智库国内版：注册来源题「从哪知道我们」（2026-11-19）

## 是什么
国内版注册时一道**可跳过**的单选题「从哪知道我们」。选项固定九个（代码 → 文字）：

| 代码 | 文字 |
|---|---|
| xiaohongshu | 小红书 |
| douyin | 抖音 |
| wechat_channels | 视频号 |
| wechat_oa | 公众号 |
| zhihu | 知乎 |
| bilibili | 哔哩哔哩 |
| search | 搜索 |
| friend | 朋友推荐 |
| other | 其他 |

没有自由填写框。不选、或再点一次取消，都等于跳过；跳过不影响注册。国际版（web-global / web-int / android-global / ios-global）不动。

## 开关
- 环境变量 **`ENERGY_CN_SIGNUP_SOURCE_ENABLED`，默认关闭（false）**。未设置或不是 `1/true/yes/on` 都算关。
- 国内网页（runtime/web，库 energy_web）：还要求 `APP_EDITION=cn`（或 `NEXT_PUBLIC_APP_EDITION=cn`）。
- App 后端（runtime/backend，库 energy_api）：只给 `market=cn` 的新账号记录。
- 两个服务各自读这个开关，要分别设置；关闭时选项接口返回 `{"enabled": false, "options": []}`，页面不显示这道题。
- 打开前要先跑迁移：网页 `prisma migrate deploy`（容器启动时 docker-entrypoint.sh 已自动执行，新增 `202611190001_signup_source_events`）；
  后端 `alembic upgrade head`（同样在 entrypoint 里，新增 `0011_signup_source_events`）。两个迁移都只新建表，不改已有表。

## 放在哪里
- **国内网页**：国内网页的注册就是「手机号 + 验证码首次登录」，随后进入 `/onboarding` 新用户引导。题目放在引导第一步（欢迎页）。
  只在**首次完成引导**（`profileCompleted` 由 false 改成 true 的那一次）时记一次；已完成引导的人再提交不记。
  选项接口：`GET /api/user/signup-source`（登录后可访问，不读任何用户信息）。
- **国内 App（android-cn / ios-cn）**：App 的实际注册路径是「手机验证码」登录（服务端对没见过的手机号直接建号）。
  题目放在登录页「手机验证码」页签里，标注「首次注册：…（选填，可跳过）」；老用户再选也不会记录。
  选项接口：`GET /api/v1/auth/signup-source`。`POST /api/v1/auth/sms/login` 和 `POST /api/v1/auth/register` 增加可选字段 `signup_source`（最长 32）。
  说明：App 里的「立即注册」页（register_screen.dart）原本就没有调用任何接口，只弹「注册成功！」后返回，这次没有改它。

## 数据怎么存
- 网页：新表 `signup_source_events`（`id, userId 唯一, source, createdAt`），外键随用户删除级联。
- 后端：新表 `signup_source_events`（`id, user_id 唯一, source, created_at`）。
- 只存枚举代码；不认识的值（自由文本、大小写不符、中文文字）在服务端直接丢掉，不报错。
- 来源**不写进**账号表，也不写进引导偏好（网页引导偏好会存进 usage_logs 的 metadata，来源单独存）。
- 写来源失败只记日志，不影响注册 / 登录 / 引导。

## 隐私
- 对外只用 `countBySource` / `count_by_source` 输出 代码 → 次数，不带任何身份字段。
- 本人导出个人信息时，导出里会有自己这一条来源代码（个人信息查询权）；不会出现在任何对他人可见的地方。
- **注销**：网页注销流程按 schema 自动删除所有带 userId 的表（`SignupSourceEvent` 已自动纳入）；后端 `POST /api/v1/privacy/delete-account` 显式删除本人的来源记录。

## 没碰的
价格、法律文本、计费 / 支付、年龄确认逻辑、国际版。
