# 证据账本（新能源智库）— 2026-10-31

本目录是「持续自改进」计划第 1 步的产物：把本轮检索（X、GitHub、HuggingFace、arXiv、政府/平台公告）里和**新能源智库**相关的来源登记成可审计的账本。
它是**登记册，不是语料**：账本里的条目不会自动进入任何检索索引或回答。

## 使用规则
1. **只有 A 级来源可以驱动内容改动**（政策条目、事实数据点、评测期望答案）。A = 本轮已读到官方/平台原文或论文全文。
2. B 级（只读到元数据、搜索摘录或媒体转述）和 lead 级（X 帖子等线索）只能作**发现线索**，要升级为 A 才能入库。
3. 带「待核」标记的条目必须回到原文复核后才能使用；复核前不得写进任何用户可见回答。
4. 许可证：`do_not_ingest`（非商用/相同方式共享）不入库、不训练、不拷贝题目；`do_not_introduce`（GPL/自定义许可证）不引入依赖或代码；`permissive_reference` 仅作思路参考，若拷贝代码须保留许可证声明。
5. 所有新条目走既有流程：来源 → 隔离区 → 离线评测 → 合规门 → 企业微信批准 → 发布。SIL 默认关闭（`SIL_ENABLED=0`），审批人名单为空，`expert_signed` 保持 false。
6. 本账本不含国内社交平台抓取结果；X 内容只当线索，不含任何投资类内容。

## 待核清单（本产品相关）
- `nea-grid-draft-2026-09` — 待核：第三方转载，盒子直连 HTTP 500；须回国家能源局原文复核
- `fgny-623-2026` — 待核：仅看到地方解读页标题，未取得原文

## 条目（21 条；A 级 4 条）
| 等级 | id | 类型 | 标题 | 许可证 | 许可分类 | 链接 | 备注 |
|---|---|---|---|---|---|---|---|
| A | `2610.24630` | arxiv | Selm: Self-Evolving Library Management for Multi-Skill Agent Optimization | n/a | n/a | https://arxiv.org/abs/2610.24630 | 全文已读：效用检索+验证门+退役名单；容量30、α=0.4（论文基准，需自测校准） |
| A | `fgny-688-2026` | policy | 发改能源〔2026〕688号 多用户绿电直连 | 政府公开 | gov_public | https://www.gov.cn/zhengce/zhengceku/202605/content_7069765.htm | 正文已读 |
| A | `gd-1805-2026` | policy | 粤发改价格函〔2026〕1805号 分布式光伏机制电价竞价 | 政府公开 | gov_public | https://drc.gd.gov.cn/ywtz/content/mpost_4965021.html | 正文已读 |
| A | `nea-2026-09-briefing` | policy | 国家能源局9月调度会（1-8月数据） | 政府公开 | gov_public | https://www.nea.gov.cn/20261008/62d48c8886be4821bfcbf9a30c2de48c/c.html | 正文已读 |
| B | `2604.27306` | arxiv | NuggetIndex: Governed Atomic Retrieval | n/a | n/a | https://arxiv.org/abs/2604.27306 | 元数据 |
| B | `2605.15230` | arxiv | EnergyAgentBench | n/a | n/a | https://arxiv.org/abs/2605.15230 | 元数据 |
| B | `2606.12903` | arxiv | X-MADAM-RAG 中英证据冲突 | n/a | n/a | https://arxiv.org/abs/2606.12903 | 元数据 |
| B | `2606.26346` | arxiv | Tool-augmented LLM agents on real-world energy analytics | n/a | n/a | https://arxiv.org/abs/2606.26346 | 元数据 |
| B | `2607.24760` | arxiv | CHaystack 中文文档检索 | n/a | n/a | https://arxiv.org/abs/2607.24760 | 元数据 |
| B | `2610.24320` | arxiv | The Judge Can Debias Itself | n/a | n/a | https://arxiv.org/abs/2610.24320 | 元数据 |
| B | `2610.25126` | arxiv | Trackable Skill Library Lifecycle Management | n/a | n/a | https://arxiv.org/abs/2610.25126 | 元数据 |
| B | `2610.27763` | arxiv | Foundation-style pretraining for distributed PV forecasting | n/a | n/a | https://arxiv.org/abs/2610.27763 | 元数据 |
| B | `2610.32379` | arxiv | LLM text features for electricity price forecasts (NEM) | n/a | n/a | https://arxiv.org/abs/2610.32379 | 元数据；警示 |
| B | `2610.36188` | arxiv | Skill Dreaming | n/a | n/a | https://arxiv.org/abs/2610.36188 | 元数据 |
| B | `PyPSA/PyPSA` | github | PyPSA | MIT | permissive_reference | https://github.com/PyPSA/PyPSA | 交叉复核 |
| B | `Qwen/Qwen3-Embedding-4B` | hf-model | Qwen3-Embedding-4B | apache-2.0 | permissive_reference | https://huggingface.co/Qwen/Qwen3-Embedding-4B | 嵌入/重排 A/B 本期暂缓（用户决定 2026-10-31） |
| B | `amazon/chronos-2` | hf-model | Chronos-2 | apache-2.0 | permissive_reference | https://huggingface.co/amazon/chronos-2 | 不采用：产品运行时只用国产模型，海外权重不引入（用户决定 2026-10-31） |
| B | `fgny-623-2026` | policy | 发改办能源〔2026〕623号 电网侧独立新型储能清单管理（解读页） | 地方解读页 | unknown | https://fgw.hunan.gov.cn/fgw/nyzsk/202610/t20261022_34086508.html | 待核：仅看到地方解读页标题，未取得原文 |
| B | `google-research/timesfm` | github | TimesFM | Apache-2.0 | permissive_reference | https://github.com/google-research/timesfm | 不采用：同上（用户决定 2026-10-31） |
| B | `nea-grid-draft-2026-09` | policy | 国家能源局《电力并网运行管理规定（征求意见稿）》 | 征求意见稿(第三方转载) | platform_or_media | http://www.cnnes.cc/zhengce/20261007/14121.html | 待核：第三方转载，盒子直连 HTTP 500；须回国家能源局原文复核 |
| B | `thuml/sundial-base-128m` | hf-model | Sundial 时序基础模型（清华） | apache-2.0 | permissive_reference | https://huggingface.co/thuml/sundial-base-128m | 本期跳过时序部分（用户决定 2026-10-31） |

数据文件：`evidence_ledger_20261031.jsonl`（同内容的机器可读版，字段：id/type/title/url/date/license/license_class/products/grade/url_status/flag/takeaway_zh/retrieved）。
