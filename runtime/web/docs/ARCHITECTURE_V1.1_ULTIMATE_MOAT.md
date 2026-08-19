# 新能源智库 - 终极护城河架构 v1.1

## 🎯 核心定位转变

**从**："会做新能源计算的AI工具"  
**到**："可信交付的新能源决策系统"

**本质差异**：
- ❌ 通用Agent：聪明的对话助手
- ✅ 新能源智库：可审计、可交付、可运营的行业系统

---

## 🏗️ 三层一体架构

### 第一层：新能源内核（Energy Kernel）

**定位**：行业级可信计算引擎

#### 1.1 口径与假设系统（Assumption & Standards）

```typescript
// assumptionVersion: 像"会计准则"一样的口径体系
interface AssumptionVersion {
  id: string;                    // "v2024.1"
  name: string;                  // "2024年标准口径"
  effectiveDate: Date;
  standards: {
    // PR计算口径
    prCalculation: {
      formula: string;           // "PR = 实际发电量 / 理论发电量"
      excludeConditions: string[]; // 排除极端天气
      referenceStandard: string;   // "IEC 61724-1:2017"
    };
    
    // LCOE计算口径
    lcoeCalculation: {
      discountRate: number;      // 折现率 8%
      systemLifetime: number;    // 25年
      degradationRate: number;   // 0.5%/年
      referenceStandard: string; // "NREL 2023"
    };
    
    // 储能套利口径
    storageArbitrage: {
      roundTripEfficiency: number; // 90%
      cycleLifetime: number;       // 6000次
      peakValleyDelta: number;     // 最小价差阈值
    };
  };
  
  changelog: string;             // 版本变更说明
  deprecated: boolean;
}
```

**核心价值**：
- 同一口径可比：不同时间、不同项目结果可严格对比
- 审计友好：每个结果都明确引用假设版本
- 行业权威感：基于IEC、NREL等标准

#### 1.2 证据链系统（Evidence Chain）

```typescript
// 每个计算/诊断结果都附带完整证据链
interface EvidenceChain {
  conclusionId: string;
  
  dataProvenance: {
    // 数据来源追溯
    solarResource: {
      source: "NASA POWER";
      timestamp: "2024-01-15T10:30:00Z";
      coordinates: { lat: 39.9, lng: 116.4 };
      cacheHit: false;
      version: "v9.0.1";
    };
    
    electricityPrice: {
      source: "国家发改委";
      policyDoc: "发改价格〔2023〕1234号";
      effectiveDate: "2023-07-01";
      scrapeDate: "2024-01-10";
    };
    
    monitoringData?: {
      stationId: string;
      recordCount: number;
      dateRange: [Date, Date];
      completeness: 0.98; // 98%数据完整性
    };
  };
  
  calculationMeta: {
    assumptionVersion: "v2024.1";
    engineVersion: "calculator@2.1.0";
    executedAt: Date;
    executionTimeMs: number;
    
    // 关键中间变量
    intermediateValues: {
      annualGHI: 1456.7;           // kWh/m²
      temperatureCorrectedPower: 98.2; // kW
      inverterClippingLoss: 2.3;   // %
      // ... 其他中间量
    };
  };
  
  uncertaintyAnalysis: {
    confidenceLevel: 0.95;         // 95%置信度
    errorBound: {
      irr: { lower: 7.2, upper: 9.8 };
      generation: { lower: 138000, upper: 152000 }; // kWh
    };
  };
  
  referencePapers?: string[];      // 关联的学术证据
  regulatoryCompliance: string[];  // 合规标准
}
```

**核心价值**：
- 完全可追溯：每个数字都能找到源头
- 可复现：保存所有参数和中间量
- 审计级严谨：误差边界、置信度明确

#### 1.3 可复现计算引擎（Reproducible Engine）

```typescript
// 所有计算输出统一格式
interface CalculationResult<T> {
  // 核心结果
  result: T;
  
  // 审计元数据
  auditMeta: {
    id: string;
    版本: string;
    assumptionVersion: string;
    executedAt: Date;
    reproducible: true;
  };
  
  // 证据链
  evidence: EvidenceChain;
  
  // 可复现命令
  reproduceCommand: {
    endpoint: "/api/v1/solar/calculate";
    body: { /* exact params */ };
    expectedHash: string; // 结果哈希，验证复现
  };
  
  // 质量标签
  qualityTag: "PREVIEW" | "STANDARD" | "AUDIT_GRADE";
  
  // 交付物引用
  deliverables?: {
    reportId?: string;
    pdfUrl?: string;
    excelUrl?: string;
  };
}
```

**核心价值**：
- 同参数必然同结果：消除不确定性
- 版本管理：算法升级不影响历史结果对比
- 质量分级：明确告知结果可信度

---

### 第二层：生命周期编排器（Orchestrator Plus）

**定位**：工作流操作系统，不是功能菜单

#### 2.1 增强的信号系统

```typescript
interface EnhancedSignals extends BaseSignals {
  // 原有信号...
  
  // 新增：证据完整性评估
  evidenceCompleteness: {
    solarResource: boolean;
    electricityPrice: boolean;
    monitoringData: boolean;
    regulatoryDocs: boolean;
    score: number; // 0-1
  };
  
  // 新增：可交付性评估
  deliverabilityScore: {
    assumptionVersionDefined: boolean;
    evidenceChainComplete: boolean;
    uncertaintyAnalyzed: boolean;
    reportTemplateReady: boolean;
    score: number; // 0-1
  };
  
  // 新增：风险信号
  riskSignals: {
    dataQualityRisk: "LOW" | "MEDIUM" | "HIGH";
    assumptionOutdated: boolean;
    complianceGap: string[];
  };
}
```

#### 2.2 可交付动作（Deliverable Actions）

```typescript
interface OrchestratorAction {
  type: "RECOMMENDATION" | "REQUIRED" | "RISK_WARNING";
  
  // 动作基本信息
  title: string;
  description: string;
  evidence: string[]; // 为什么推荐这个动作
  
  // 交付物预期
  deliverable: {
    type: "REPORT" | "CERTIFICATE" | "ANALYSIS";
    template: string;
    estimatedTime: number; // 分钟
    requiredQuality: "PREVIEW" | "STANDARD" | "AUDIT_GRADE";
  };
  
  // 风险与权限
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  requiredPermission?: "PRO" | "ENTERPRISE";
  requiresConfirmation: boolean;
  
  // 执行路径
  cta: {
    label: string;
    link: string;
    preChecks: string[]; // 执行前需确认的前置条件
  };
  
  // 付费触发（但不打断口碑）
  pricing?: {
    tier: "FREE" | "PRO" | "ENTERPRISE";
    softPaywall: boolean; // true = 提示但可继续
    hardPaywall: boolean; // true = 必须升级
  };
}
```

**核心价值**：
- 明确交付物：用户知道做完能得到什么
- 风险透明：高风险操作需要确认
- 权限清晰：企业功能vs个人功能

#### 2.3 阶段-交付物映射

```typescript
// 每个阶段对应标准化交付物
const STAGE_DELIVERABLES = {
  SITE_SELECTION: {
    primary: "资源评估报告",
    includes: ["GHI/DNI数据", "政策文件清单", "初步测算"],
    template: "templates/resource-assessment.docx"
  },
  
  ECONOMICS_ANALYSIS: {
    primary: "投资分析报告",
    includes: ["IRR/NPV/LCOE", "现金流表", "敏感性分析"],
    template: "templates/investment-analysis.xlsx",
    auditGrade: true // 可用于银行贷款
  },
  
  OPERATIONS: {
    primary: "运维月报",
    includes: ["PR分析", "故障记录", "清洗建议", "损失量化"],
    template: "templates/monthly-report.pdf",
    recurring: true
  },
  
  DIAGNOSTICS: {
    primary: "诊断复盘报告",
    includes: ["故障定位", "停机损失", "处理建议", "预防措施"],
    template: "templates/diagnostic-report.pdf",
    evidenceRequired: ["监测数据", "现场照片", "专家结论"]
  }
};
```

---

### 第三层：交付与沉淀系统（Deliver + Memory）

**定位**：资产化、可审计、锁迁移成本

#### 3.1 项目时间线（Timeline）

```typescript
interface ProjectTimeline {
  projectId: string;
  
  milestones: Array<{
    id: string;
    timestamp: Date;
    type: "CALCULATION" | "DIAGNOSIS" | "REPORT" | "DECISION" | "AI_CONCLUSION";
    
    title: string;
    summary: string;
    
    // 可复现引用
    artifactId: string;
    evidenceChainId: string;
    
    // 交付物
    deliverables: Array<{
      type: "PDF" | "EXCEL" | "JSON";
      url: string;
      hash: string; // 防篡改
    }>;
    
    // 审计信息
    executor: {
      type: "USER" | "AI" | "SYSTEM";
      userId?: string;
      aiModel?: string;
      assumptionVersion: string;
    };
    
    // 影响量化
    impact?: {
      financialSaving?: number; // 省钱
      generationIncrease?: number; // 增发电
      downtime Reduced?: number; // 减停机
    };
  }>;
  
  tags: string[]; // 方便搜索
  exportable: true; // 可导出完整审计包
}
```

**核心价值**：
- 完整项目历史：所有决策可追溯
- 量化价值：每个动作的ROI清晰
- 可导出审计：满足企业合规需求

#### 3.2 标准化报告体系

```typescript
// 统一的报告结构
interface StandardReport {
  // 封面页
  cover: {
    projectName: string;
    reportType: "资源评估" | "投资分析" | "运维月报" | "诊断复盘";
    generatedAt: Date;
    assumptionVersion: string;
    confidenceLevel: "95%";
    organizationLogo?: string;
  };
  
  // 执行摘要
  executiveSummary: {
    keyFindings: string[];
    recommendations: string[];
    riskWarnings: string[];
    quickNumbers: Record<string, number>; // IRR, LCOE等关键指标
  };
  
  // 详细分析
  detailedAnalysis: {
    sections: Array<{
      title: string;
      content: string; // Markdown
      charts: ChartData[];
      tables: TableData[];
    }>;
  };
  
  // 证据附件页
  evidenceAppendix: {
    assumptionSet: AssumptionVersion;
    dataSources: EvidenceChain["dataProvenance"];
    calculations: {
      formula: string;
      intermediateSteps: Record<string, number>;
      references: string[];
    }[];
    uncertaintyAnalysis: EvidenceChain["uncertaintyAnalysis"];
  };
  
  // 合规声明页
  compliance: {
    standards: string[]; // "IEC 61724-1:2017"
    regulatoryApproval?: string; // 监管备案号
    disclaimers: string[];
    signature?: {
      engineer: string;
      date: Date;
      license?: string; // 工程师执照号
    };
  };
  
  // 元数据（机器可读）
  metadata: {
    reportId: string;
    version: string;
    hash: string; // 防篡改
    reproducible: boolean;
    auditTrail: string; // 审计日志ID
  };
}
```

**核心价值**：
- 标准化：客户认可，可直接提交审批
- 专业背书：合规声明、工程师签字
- 防篡改：哈希校验，可验证真实性

---

## 🛡️ 七道结构型壁垒实施路径

### 壁垒1：口径版本化

**实施**：
```typescript
// lib/kernel/assumption-manager.ts
class AssumptionManager {
  // 获取当前生效版本
  getCurrentVersion(): AssumptionVersion;
  
  // 版本比较
  compareResults(
    resultA: CalculationResult,
    resultB: CalculationResult
  ): ComparisonReport;
  
  // 版本升级影响分析
  upgradeImpactAnalysis(
    projectId: string,
    newVersion: string
  ): ImpactReport;
}
```

**数据库**：
```sql
CREATE TABLE assumption_versions (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  effectiveDate TIMESTAMP NOT NULL,
  standards JSONB NOT NULL,
  changelog TEXT,
  deprecated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 壁垒2：证据链与可复现

**实施**：
```typescript
// lib/kernel/evidence-chain.ts
class EvidenceBuilder {
  constructor(private conclusionId: string) {}
  
  addDataSource(key: string, provenance: DataProvenance): this;
  addCalculationMeta(meta: CalculationMeta): this;
  addUncertaintyAnalysis(analysis: UncertaintyAnalysis): this;
  
  build(): EvidenceChain;
  
  // 验证证据完整性
  validate(): ValidationResult;
  
  // 生成可复现命令
  generateReproduceCommand(): ReproduceCommand;
}
```

**集成到所有计算**：
```typescript
// lib/calculator/solar.ts
export async function calculateSolarRevenue(params) {
  const evidence = new EvidenceBuilder(conclusionId);
  
  // 记录数据来源
  const solarData = await fetchSolarResource(params.location);
  evidence.addDataSource('solarResource', {
    source: 'NASA POWER',
    timestamp: new Date(),
    ...solarData.meta
  });
  
  // 执行计算
  const result = /* ... calculations ... */;
  
  // 记录计算元数据
  evidence.addCalculationMeta({
    assumptionVersion: getCurrentAssumptionVersion(),
    engineVersion: '2.1.0',
    executedAt: new Date(),
    intermediateValues: { /* ... */ }
  });
  
  return {
    result,
    evidence: evidence.build(),
    auditMeta: { /* ... */ }
  };
}
```

### 壁垒3：诊断闭环

**实施**：
```typescript
// lib/maintenance/diagnostic-flow.ts
interface DiagnosticFlow {
  // 1. 发现问题
  detect(stationData: MonitoringData): Anomaly[];
  
  // 2. 量化损失
  quantifyLoss(anomaly: Anomaly): {
    downtime: number; // 小时
    lostGeneration: number; // kWh
    lostRevenue: number; // 元
  };
  
  // 3. 决策建议
  recommend(anomaly: Anomaly): {
    action: "清洗" | "维修" | "更换";
    urgency: "立即" | "本周" | "本月";
    estimatedCost: number;
    expectedROI: number;
    riskIfDelay: string;
  };
  
  // 4. 执行跟踪
  track(actionId: string): {
    status: "待审批" | "执行中" | "已完成";
    actualCost?: number;
    actualEffect?: number;
  };
  
  // 5. 效果复盘
  review(actionId: string): {
    roiRealized: number;
    lessonsLearned: string[];
    nextPreventiveAction: string;
  };
}
```

### 壁垒4：交付物体系

**实施**：
```typescript
// lib/deliverables/report-generator.ts
class ReportGenerator {
  async generate(
    type: ReportType,
    projectId: string,
    options: ReportOptions
  ): Promise<StandardReport> {
    // 加载模板
    const template = loadTemplate(type);
    
    // 聚合数据
    const data = await aggregateData(projectId);
    
    // 构建证据链
    const evidence = await buildEvidenceChain(data);
    
    // 生成报告
    const report = renderReport(template, data, evidence);
    
    // 添加元数据和哈希
    report.metadata = {
      reportId: generateId(),
      hash: hashContent(report),
      reproducible: true,
      auditTrail: logToAuditTrail(report)
    };
    
    // 导出PDF/Excel
    await exportToPDF(report);
    await exportToExcel(report);
    
    return report;
  }
}
```

### 壁垒5：安全与责任边界

**实施**：
```typescript
// lib/kernel/safety-boundary.ts
class SafetyBoundary {
  // 风险评估
  assessRisk(operation: Operation): RiskLevel {
    if (operation.type === "MAINTENANCE") {
      if (operation.impact > CRITICAL_THRESHOLD) {
        return "HIGH"; // 需要二次确认
      }
    }
    return calculateRisk(operation);
  }
  
  // 权限检查
  checkPermission(userId: string, operation: Operation): boolean {
    const user = getUser(userId);
    const requiredRole = OPERATION_PERMISSIONS[operation.type];
    return user.role >= requiredRole;
  }
  
  // 操作审计
  auditOperation(operation: Operation, executor: User): AuditLog {
    return {
      timestamp: new Date(),
      operation: operation.type,
      executor: executor.id,
      params: operation.params,
      result: operation.result,
      approvals: operation.requiresApproval ? getApprovals() : null
    };
  }
}
```

### 壁垒6：成本控制与SLA

**实施**：
```typescript
// lib/ai/smart-routing.ts
class ModelRouter {
  route(task: AITask): ModelConfig {
    // 普通问答 → 便宜模型
    if (task.type === "QA" && task.complexity === "LOW") {
      return { model: "gemini-flash", maxTokens: 500 };
    }
    
    // 高价值决策 → 强模型
    if (task.type === "DECISION" && task.valueAtStake > 10000) {
      return { model: "claude-3.5-sonnet", maxTokens: 4096 };
    }
    
    // 工具调用 → 优化策略
    if (task.type === "TOOL_CALL") {
      return { model: "gpt-4o-mini", tools: WHITELISTED_TOOLS };
    }
    
    return DEFAULT_CONFIG;
  }
  
  // 成本追踪
  trackCost(taskId: string, tokenUsage: TokenUsage): void {
    const cost = calculateCost(tokenUsage);
    logCost(taskId, cost);
    
    if (cost > ALERT_THRESHOLD) {
      alertExpensiveOperation(taskId);
    }
  }
}
```

### 壁垒7：通用Agent变成渠道

**实施**：
```typescript
// app/api/v1/agent-interface/route.ts
// 标准化Agent接口（OpenClaw等可调用）

export async function POST(req: Request) {
  const { action, params } = await req.json();
  
  // 验证API Key
  const apiKey = validateApiKey(req);
  if (!apiKey) return unauthorized();
  
  // 执行核心能力
  const result = await executeWithEvidenceChain(action, params);
  
  // 返回结构化结果（带证据链）
  return {
    result: result.data,
    evidence: result.evidence, // 完整证据链
    deliverables: result.deliverables, // 可下载的报告
    assumptionVersion: result.assumptionVersion,
    
    // 引导深度使用
    deepDiveUrl: `/projects/${result.projectId}`,
    message: "完整项目管理和历史记录请访问新能源智库"
  };
}
```

**效果**：
- Agent负责"触达用户"
- 我们负责"可信交付"
- Agent调用越多→我们价值越大
- 但核心资产、时间线、审计都在我们这

---

## 📊 架构实施优先级

### Phase 1: 核心内核（2周）
- [ ] AssumptionVersion系统
- [ ] EvidenceChain基础设施
- [ ] 重构Calculator输出格式
- [ ] AuditMeta统一接口

### Phase 2: 编排增强（1周）
- [ ] Enhanced Signals
- [ ] Deliverable Actions
- [ ] Stage-Deliverable映射
- [ ] 风险评估系统

### Phase 3: 交付系统（2周）
- [ ] ProjectTimeline完整实现
- [ ] StandardReport模板
- [ ] PDF/Excel导出
- [ ] Hash与防篡改

### Phase 4: 壁垒固化（1周）
- [ ] SafetyBoundary系统
- [ ] 权限与审批流
- [ ] 成本追踪与优化
- [ ] Agent接口标准化

---

## 🎯 成功指标

**对内指标**：
- ✅ 100%计算结果可复现
- ✅ 95%+证据链完整性
- ✅ 每个项目有完整Timeline
- ✅ 所有报告可导出可审计

**对外指标**：
- 📈 企业客户占比（需要审计级）
- 📈 报告下载/使用率
- 📈 Agent API调用量
- 📉 迁移到竞品率（应趋近0）

---

## 💬 产品北极星（Polaris）

> **"大模型会越来越像通用助理，  
> 而新能源智库要成为可信交付的行业系统。  
> 助理可以帮你做事，  
> 但项目决策、审计背书、资产复盘，  
> 最终必须回到系统。"**

---

*架构版本: v1.1 Ultimate Moat*  
*创建时间: 2026-02-03*  
*状态: 架构设计完成，待实施*
