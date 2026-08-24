# 报告导出实测记录（2026-07-30）

本记录验证新能源项目投资分析报告的国内版与国际版 Word/PDF 导出结果。
仓库内样例使用明确标注的演示数据，不应作为投资依据。

## 质量门禁

- 中文 Word：6 页，未发现空白页、缺字方框、内容溢出或表格截断。
- 中文 PDF：4 页，目录、财务指标、敏感性分析、ESG、建议和数据溯源完整。
- 国际 Word：2 页，页面及正文为英文。
- 国际 PDF：2 页，页面及正文为英文。
- 国际导出遇到仅含中文的源记录时，使用英文名称与地点占位，不泄露未翻译字段。
- Word 表格首行均标记为可访问性表头；文档无障碍审计为 0 个高、中、低风险项。
- 报告代码专项测试 20 项全部通过；后端全量测试 336 项通过、30 项按环境条件跳过。

## 字体与生产环境

中文版 Word 使用 `PingFang SC` 作为东亚字体声明。Windows、Linux 或容器环境必须
安装可替代的 CJK 字体并正确配置 Fontconfig；渲染门禁应在加载字体配置后执行，
防止导出文件在无字体环境中出现方框。

## 证据文件

- `docs/report-samples/energy-cn-investment-report.docx`
- `docs/report-samples/energy-cn-investment-report.pdf`
- `docs/report-samples/energy-global-investment-report.docx`
- `docs/report-samples/energy-global-investment-report.pdf`
- `docs/screenshots/report-export/`

