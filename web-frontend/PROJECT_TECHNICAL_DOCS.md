# SolarWind Pro (新能源智库) - 全景技术与功能手册

> **项目定位**：面向中国新能源从业者的“新能源项目智能决策系统”，旨在 30 分钟内完成从选点到立项的工程级评估。

---

## 1. 核心功能实现方案

### 1.1 智能测算引擎 (Calculators)
核心逻辑位于 `src/lib/calculator/`，通过集成全球权威数据实现高精度估算：
- **光伏测算 (`solar.ts`)**：集成 **NASA POWER** (辐照度) 与 **NREL PVWatts** (产能计算)。支持屋顶/地面/车棚等多种安装场景，自动计算 IRR、回收期、LCOE 及碳减排贡献。
- **风电测算 (`wind.ts`)**：基于威布尔分布和风机功率曲线，结合轮毂高度与风速分布，模拟年等效满发小时数。
- **储能测算 (`storage.ts`)**：支持充放电效率模拟，结合峰谷电价差计算调峰收益与投资回收期。

### 1.2 能源 AI 专家架构
基于统一的 AI 调度层 (`src/lib/ai/`)，实现多模型路由与工具化执行：
- **AI Router (`router.ts`)**：支持 Claude 3.5, GPT-4o, 及通义千问 (Qianwen) 等主流模型。
- **Tool Executor (`tool-executor.ts`)**：通过自定义 Tool Calling 机制，让 AI 能够调用系统内的实时测算 API、天气查询、政策库等 30+ 种专业工具。
- **运维诊断 (`maintenance/`)**：封装了 PR 分析、IV 曲线诊断、清洗决策建议等专业运维算法，可由 AI 助手直接触发。

### 1.3 知识库与 RAG 引擎
针对新能源行业的信息碎片化问题，构建了基于 RAG (检索增强生成) 的知识闭环。
- **文献管理 (`src/lib/papers/`)**：集成 Crossref, Arxiv, Semantic Scholar。支持 PDF 上传、自动解析、语义索引。
- **智能对话**：支持基于本地 PDF 库的细节检索与长文本深度总结，解决“论文读不完”的问题。

### 1.4 商业与会员闭环
完整的 SaaS 商业系统模型封装在 `src/prisma/schema.prisma`：
- **分级会员系统**：FREE, PRO, TEAM, ENTERPRISE 六级权限，控制 AI 调用、测算频次及报告导出配额。
- **增长机制**：内置邀请记录、积分墙、成就系统及每日签到，提升用户粘性。

---

## 2. 系统技术架构

### 2.1 核心技术栈
- **前端框架**：Next.js 14 (App Router) + TypeScript
- **样式系统**：Tailwind CSS + Framer Motion (微交互)
- **数据持久化**：PostgreSQL + Prisma ORM
- **三方云服务**：阿里云 OSS (文件存储), Sentry (监控)
- **认证/国际化**：NextAuth.js, next-intl (中英双语)

### 2.2 数据库设计要点
系统拥有超过 20 张核心表，支持复杂的业务逻辑：
- **User/Subscription/Order**：构成核心支付与权限控制模块。
- **Project/Calculation/Diagnosis**：存储用户的决策全过程数据。
- **SavedPaper/PaperFolder/Node**：支撑 RAG 知识库的分层存储。

### 2.3 外部集成 Layer
系统通过 `src/lib/api/` 对外提供聚合访问：
- **地理信息**：高德地图 API (`amap.ts`)。
- **气象/地理**：NASA, Open-Meteo, Elevation API。
- **学术资源**：Unpaywall, OpenAlex 等资源接口。

---

## 3. 开发者指南

### 3.1 环境变量配置 (`.env`)
系统依赖多个核心密钥，必须配置以下项方可完整运行：
- `DATABASE_URL`: PostgreSQL 路径。
- `NEXTAUTH_SECRET`: 校验 Token 密钥。
- `ALIYUN_OSS_*`: 阿里云文件服务配置。
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`: 驱动 AI 的底座。

### 3.2 快速启动
```bash
# 1. 安装依赖
npm install

# 2. 数据库同步
npx prisma db push

# 3. 启动开发环境
npm run dev
```

### 3.3 容器化与部署
项目提供了标准 `Dockerfile`。使用多阶段构建，最终镜像仅包含静态资源与 `standalone` server，极大优化了部署体积。生产环境建议通过 `start.sh` 进行环境预检。

---

## 4. 总结
本项目不仅是一个简单的 Web 应用，而是一个集成了**数据聚合 (ETL)**、**工程算法 (Math Engine)** 及 **RAG AI 代理 (Agents)** 的垂直行业生产工具。其高度模块化的代码设计（如 `lib/ai` 与 `lib/calculator` 的彻底解耦）为后续的功能扩展提供了坚实的基础。
