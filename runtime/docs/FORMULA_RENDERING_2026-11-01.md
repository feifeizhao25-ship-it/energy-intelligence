# 新能源 公式渲染：文档更正（2026-11-01，X10）

D5 9-1 与 D1 E22 写"App 端未见公式渲染"，与代码不符，更正如下：
- Flutter 四端（`android-cn`、`android-global`、`ios-cn`、`ios-global`）的 `lib/widgets/ai_message_body.dart` 使用 `flutter_math_fork` 渲染 LaTeX 公式（`pubspec.yaml` 均已声明）。
- 网页端 `runtime/web` 与 `web-global` 依赖 KaTeX，`runtime/web/src/components/ai/AiMarkdown.tsx` 渲染公式。
- 因此该项不再是缺口。仍需在真机/浏览器上目视验证长公式换行、深色模式和 200% 字号下的显示，这是测试方案里的验证项，不是代码缺口。
- 回归保护：`runtime/backend/tests/test_docs_alignment_20261101.py` 检查上述依赖仍然存在。
