# 新能源智库 - 竞争护城河技术设计 v1.1

> **核心策略**: 把胜负从"会不会做"改成"做得准不准、能不能交付、出事谁负责"

## 目录

1. [设计理念](#设计理念)
2. [护城河架构](#护城河架构)
3. [已实现功能清单](#已实现功能清单)
4. [模块详解](#模块详解)
5. [API 端点](#api-端点)
6. [前端组件](#前端组件)
7. [数据库架构](#数据库架构)
8. [OpenClaw 集成](#openclaw-集成)

---

## 设计理念

### 核心竞争维度

| 维度 | 通用 AI Agent | 新能源智库 |
|-----|--------------|-----------|
| 可解释性 | 对话→动作，链路复杂 | 每次计算可追溯、可复现 |
| 专业正确性 | 容易犯"行业口径错误" | 工程化沉淀的口径库 |
| 安全边界 | 广权限 + 技能风险 | 工具白名单 + 沙箱执行 |
| 交付物 | 聊天记录 | 可审计的专业报告 |

### 战略定位

1. **"新能源工作流 OS"** - 用户每天的工作从这里开始
2. **数据资产壁垒** - 用户用得越久，迁移成本越高
3. **渠道化策略** - 把 OpenClaw 变成分发渠道

---

## 护城河架构

```
┌────────────────────────────────────────────────────────────────┐
│                         前端组件层                              │
│  ┌─────────────┐ ┌──────────────┐ ┌───────────┐ ┌───────────┐  │
│  │ConclusionCard│ │DiagnosticSum│ │ Timeline  │ │ QuotaPanel│  │
│  └─────────────┘ └──────────────┘ └───────────┘ └───────────┘  │
└────────────────────────────────────────────────────────────────┘
                               │
┌────────────────────────────────────────────────────────────────┐
│                         API 层                                  │
│  /api/audit   /api/quota   /api/projects/:id/timeline          │
│  /api/v1/openclaw                                              │
└────────────────────────────────────────────────────────────────┘
                               │
┌────────────────────────────────────────────────────────────────┐
│                      护城河核心库                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                     src/lib/audit/                        │ │
│  │  ┌─────────────┐ ┌──────────────┐ ┌──────────────────┐   │ │
│  │  │    types    │ │ calibrations │ │   audit-service  │   │ │
│  │  └─────────────┘ └──────────────┘ └──────────────────┘   │ │
│  │  ┌─────────────┐ ┌──────────────┐ ┌──────────────────┐   │ │
│  │  │ conclusion  │ │   timeline   │ │      quota       │   │ │
│  │  └─────────────┘ └──────────────┘ └──────────────────┘   │ │
│  │  ┌─────────────┐ ┌──────────────┐ ┌──────────────────┐   │ │
│  │  │tool-whitelist│ │  enterprise  │ │  openclaw-skill  │   │ │
│  │  └─────────────┘ └──────────────┘ └──────────────────┘   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                   src/lib/report/                         │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │              report-generator                        │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
                               │
┌────────────────────────────────────────────────────────────────┐
│                        数据持久层                               │
│  AuditLog  ProjectTimeline  QuotaUsage  Organization  Report   │
└────────────────────────────────────────────────────────────────┘
```

---

## 已实现功能清单

### ✅ 10条"追不上清单"

| # | 功能 | 状态 | 文件位置 |
|---|------|------|---------|
| 1 | 所有计算结果增加 calcVersion、assumptionVersion、dataEvidence | ✅ | `lib/audit/types.ts`, `audit-service.ts` |
| 2 | 输出统一 ConclusionCard | ✅ | `lib/audit/conclusion-card.ts` |
| 3 | 诊断输出统一 DiagnosticSummary | ✅ | `lib/audit/conclusion-card.ts` |
| 4 | 项目时间线 Timeline | ✅ | `lib/audit/timeline.ts` |
| 5 | 一键报告导出（模板化、可审计） | ✅ | `lib/report/report-generator.ts` |
| 6 | 工具调用白名单 | ✅ | `lib/audit/tool-whitelist.ts` |
| 7 | 风险分级与二次确认 | ✅ | `lib/audit/audit-service.ts` |
| 8 | 组织级权限与审计 | ✅ | `lib/audit/enterprise.ts` |
| 9 | 成本与配额系统 | ✅ | `lib/audit/quota.ts` |
| 10 | OpenClaw skill | ✅ | `lib/audit/openclaw-skill.ts` |

---

## 模块详解

### 1. 审计与可追溯系统 (`lib/audit/`)

#### types.ts - 核心类型定义

```typescript
// 计算版本元数据
interface CalcVersionMeta {
  calcVersion: string;       // 计算引擎版本
  assumptionVersion: string; // 假设集版本
  modelVersion?: string;     // 模型版本
  timestamp: string;         // 计算时间戳
}

// 数据来源证据
interface DataEvidence {
  sourceId: string;
  sourceName: string;
  sourceType: 'NASA_POWER' | 'NREL' | 'POLICY_DB' | 'USER_INPUT' | ...;
  fetchedAt: string;
  snapshotId?: string;
}

// 可审计输出包装器
interface AuditableResult<T> {
  result: T;
  audit: {
    auditId: string;
    calcVersion: string;
    assumptionVersion: string;
    reproducibilityHash: string;
  };
  calibrations: CalibrationStandard[];
  riskWarnings?: RiskWarning[];
}
```

#### calibrations.ts - 新能源口径库

建立行业术语/指标定义的"会计准则"：

- **PR** - 系统效率/性能比 (IEC 61724-1:2021)
- **IRR** - 内部收益率 (GB/T 12497-2006)
- **LCOE** - 平准化度电成本 (NREL/IEA)
- **等效利用小时** (NEA统计口径)
- ... 共17个核心指标

#### audit-service.ts - 审计服务

```typescript
// 创建审计记录
const auditRecord = await createAuditRecord({
  type: 'CALCULATION',
  projectId,
  userId,
  inputs: { lat, lng, capacity, ... },
  outputs: { irr, npv, payback, ... },
  evidences: [{ source: 'NASA_POWER', ... }],
  assumptions: standardAssumptionSet,
});

// 包装为可审计结果
const result = wrapAuditableResult(
  calculationResult,
  auditRecord,
  ['IRR', 'PR', 'LCOE'],  // 引用的口径
  riskWarnings,
  0.95  // 置信度
);
```

### 2. 结论卡片与诊断摘要 (`conclusion-card.ts`)

统一所有输出格式，确保"可交付":

```typescript
const card = createConclusionCard({
  type: 'SOLAR_CALC',
  title: '屋顶分布式光伏收益测算',
  headline: 'IRR 12.5%，6年回本，建议投资',
  summary: '...',
  keyMetrics: [
    { name: 'IRR', value: 12.5, unit: '%', trend: 'STABLE' },
    { name: '回收期', value: 6, unit: '年' },
  ],
  recommendation: {
    level: 'RECOMMENDED',
    reason: '...',
    confidence: 0.92,
  },
  ...
});
```

### 3. 项目时间线 (`timeline.ts`)

每次操作沉淀成时间线，成为用户数据资产：

```typescript
await createTimelineEvent({
  projectId,
  userId,
  type: 'CALCULATION_DONE',
  title: '光伏收益测算完成',
  description: 'IRR 12.5%, 回收期 6年',
  data: { irr: 0.125, payback: 6 },
  auditId,
  isMilestone: true,
});
```

### 4. 配额系统 (`quota.ts`)

套餐差异化的配额管理：

| 类型 | FREE | PRO | ENTERPRISE |
|-----|------|-----|------------|
| AI调用 | 20/天 | 500/天 | 无限 |
| 收益测算 | 5/天 | 100/天 | 无限 |
| 诊断分析 | 2/天 | 50/天 | 无限 |
| 报告导出 | 1/天 | 20/天 | 无限 |
| 项目数 | 3 | 50 | 无限 |
| API调用 | 0 | 1000/天 | 无限 |

### 5. 工具白名单 (`tool-whitelist.ts`)

AI只能调用定义好的工具：

```typescript
const TOOL_WHITELIST = {
  get_solar_resource: { riskLevel: 'READ_ONLY', ... },
  calculate_solar: { quotaType: 'CALCULATIONS', ... },
  generate_work_permit: { 
    riskLevel: 'HIGH_WRITE',
    requiresConfirmation: true,
    ...
  },
};
```

### 6. 企业版权限 (`enterprise.ts`)

完整的 RBAC 权限模型：

```typescript
type UserRole = 'VIEWER' | 'OPERATOR' | 'ANALYST' | 'ENGINEER' | 'MANAGER' | 'ADMIN' | 'OWNER';

// 权限检查
hasPermission('ANALYST', 'calculation:create'); // true
hasPermission('VIEWER', 'calculation:create');  // false
```

### 7. 报告生成 (`lib/report/report-generator.ts`)

8种专业报告模板：

- 可研摘要
- 投资分析报告
- 站址比选报告
- 月度运维报告
- 年度复盘报告
- 诊断分析报告
- 异常复盘报告
- 执行摘要

---

## API 端点

| 端点 | 方法 | 用途 |
|-----|------|------|
| `/api/audit/[id]` | GET | 获取审计记录（用于复现验证） |
| `/api/projects/[id]/timeline` | GET | 获取项目时间线 |
| `/api/quota` | GET | 获取用户配额使用情况 |
| `/api/quota/check` | POST | 检查指定操作是否有配额 |
| `/api/v1/openclaw` | GET/POST | OpenClaw Skill 端点 |

---

## 前端组件

| 组件 | 文件 | 用途 |
|-----|------|------|
| `ConclusionCard` | `components/moat/ConclusionCard.tsx` | 统一结论展示 |
| `DiagnosticSummary` | `components/moat/DiagnosticSummary.tsx` | 诊断结果展示 |
| `ProjectTimeline` | `components/moat/ProjectTimeline.tsx` | 项目时间线 |
| `QuotaPanel` | `components/moat/QuotaPanel.tsx` | 配额使用面板 |

---

## 数据库架构

新增表：

- `AuditLog` - 审计日志
- `ProjectTimeline` - 项目时间线
- `QuotaUsage` - 配额使用
- `Organization` - 组织
- `OrganizationMember` - 组织成员
- `ApprovalRequest` - 审批请求
- `ComplianceEvent` - 合规事件
- `OpenClawApiKey` - OpenClaw API Key
- `ConclusionCard` - 结论卡片
- `DiagnosticSummary` - 诊断摘要
- `Report` - 报告

---

## OpenClaw 集成

### Skill 清单

```json
{
  "id": "xinnengyuan-ai",
  "name": "新能源智库",
  "capabilities": [
    "solar_assessment",   // 光伏收益评估
    "wind_assessment",    // 风电收益评估
    "pr_diagnosis",       // PR诊断分析
    "paper_search"        // 学术论文检索
  ]
}
```

### 使用方式

```bash
# OpenClaw 用户调用示例
POST /api/v1/openclaw
Authorization: Bearer xny_xxxxx
{
  "capability": "solar_assessment",
  "input": { "lat": 39.9, "lng": 116.4, "capacity": 20 }
}
```

### 商业模式

- 每日10次免费调用
- 超出后引导用户访问 xinnengyuan.ai 升级
- OpenClaw 成为获客渠道

---

## 使用示例

### 1. 创建可审计的计算结果

```typescript
import { 
  createAuditRecord, 
  wrapAuditableResult,
  createConclusionCard,
  recordCalculationEvent,
} from '@/lib/audit';

// 1. 执行计算
const calcResult = await calculateSolar(params);

// 2. 创建审计记录
const auditRecord = await createAuditRecord({
  type: 'CALCULATION',
  projectId,
  userId,
  inputs: params,
  outputs: calcResult,
  evidences: [{ sourceType: 'NASA_POWER', ... }],
  assumptions: standardAssumptions,
  calibrations: ['IRR', 'LCOE', 'PR'],
});

// 3. 包装为可审计结果
const auditableResult = wrapAuditableResult(
  calcResult,
  auditRecord,
  ['IRR', 'LCOE', 'PR'],
);

// 4. 创建结论卡片
const card = createConclusionCard({
  type: 'SOLAR_CALC',
  title: '光伏收益测算',
  headline: `IRR ${(calcResult.irr * 100).toFixed(1)}%，${calcResult.payback.toFixed(1)}年回本`,
  ...
  auditId: auditRecord.id,
  calcVersion: auditRecord.versionMeta.calcVersion,
});

// 5. 记录时间线
await recordCalculationEvent(projectId, userId, 'SOLAR', {
  irr: calcResult.irr,
  paybackYears: calcResult.payback,
}, auditRecord.id);
```

### 2. 配额检查

```typescript
import { checkQuota, consumeQuota } from '@/lib/audit';

// 检查配额
const { allowed, usage } = await checkQuota(userId, 'CALCULATIONS');
if (!allowed) {
  throw new Error('今日计算配额已用尽');
}

// 执行计算...

// 消耗配额
await consumeQuota(userId, 'CALCULATIONS');
```

---

**护城河已构建完成。通用 AI Agent 再强，也难以追平这套"可审计、专业正确、安全边界明确、能交付报告"的垂直解决方案。**
