# 终极护城河架构 - 快速上手指南

## 🎯 5分钟理解核心思想

### 问题：为什么需要这套架构？

**场景对比**：

```
传统方式（会被OpenClaw替代）：
用户："算一下100kW光伏IRR"
系统："8.5%"
用户："为什么？"
系统："基于一些计算..."
→ 通用AI也能做到这个水平

新架构方式（OpenClaw无法替代）：
用户："生成100kW光伏投资分析报告"
系统：返回可审计报告，包含：
  ✅ 结果：IRR 8.5% (置信区间 7.2%-9.8%)
  ✅ 口径：基于v2024.1标准（IEC 61724-1:2017）
  ✅ 证据：NASA POWER数据（2023-01-01~12-31）
  ✅ 可复现：curl命令 + 预期哈希
  ✅ 交付物：PDF报告，可签字，能贷款
→ 这是系统级能力，AI仅能调用，无法替代
```

### 核心是什么？

**三层防护**：
1. **内核层**：口径+证据+可复现 → 让结果"可信"
2. **编排层**：工作流+交付物+风险控制 → 让系统"好用"
3. **沉淀层**：时间线+报告+资产管理 → 让用户"离不开"

---

## 🚀 开发者快速上手

### 步骤1：理解核心模块

```typescript
// 📦 三个核心模块位置
src/lib/kernel/
├── assumption-manager.ts    // 口径管理（像"会计准则"）
├── evidence-chain.ts         // 证据链（数据来源追溯）
└── calculation-result.ts     // 结果格式（统一标准）
```

### 步骤2：查看示例代码

打开 `src/lib/calculator/solar-v2.ts`，这是**完整集成示例**：

```typescript
// 1. 导入核心模块
import { AssumptionManager } from '../kernel/assumption-manager';
import { EvidenceBuilder } from '../kernel/evidence-chain';
import { ResultBuilder } from '../kernel/calculation-result';

// 2. 执行计算
export class SolarCalculatorV2 {
  static async calculate(params) {
    // 2.1 获取口径版本
    const version = AssumptionManager.getCurrentVersion();
    
    // 2.2 获取数据
    const data = await fetchSolarResource();
    
    // 2.3 执行计算
    const result = performCalculation(params, data, version.standards);
    
    // 2.4 构建证据链
    const evidence = new EvidenceBuilder('id')
      .addSolarResource({ source: 'NASA POWER', ... })
      .addCalculationMeta({ assumptionVersion: version.id, ... })
      .addUncertaintyAnalysis({ confidenceLevel: 0.95, ... })
      .build();
    
    // 2.5 返回标准格式
    return new ResultBuilder(result, 'solar', '2.1.0', 'AUDIT_GRADE')
      .setEvidence(evidence)
      .setReproduceCommand(...)
      .build();
  }
}
```

**关键点**：
- ✅ 每个计算必须引用口径版本
- ✅ 每个数据来源必须记录
- ✅ 每个结果必须可复现
- ✅ 质量等级必须明确

### 步骤3：创建新的计算器

**模板**：

```typescript
// src/lib/calculator/your-calculator-v2.ts

import { AssumptionManager } from '../kernel/assumption-manager';
import { EvidenceBuilder } from '../kernel/evidence-chain';
import { ResultBuilder } from '../kernel/calculation-result';

export interface YourCalculationData {
  // 定义你的结果数据结构
  someMetric: number;
  otherMetric: number;
}

export class YourCalculatorV2 {
  private static readonly ENGINE_VERSION = "1.0.0";
  
  static async calculate(params: any) {
    const startTime = Date.now();
    
    // 1. 获取口径
    const assumptionVersion = AssumptionManager.getCurrentVersion();
    
    // 2. 获取数据（记录来源！）
    const sourceData = await this.fetchData(params);
    
    // 3. 执行核心计算
    const calculationData = this.performCalculation(
      params,
      sourceData,
      assumptionVersion.standards
    );
    
    // 4. 构建证据链
    const evidence = new EvidenceBuilder(`your-calc-${Date.now()}`)
      .addDataSource('yourDataSource', {
        source: sourceData.source,
        timestamp: new Date(),
        cacheHit: sourceData.cached,
        metadata: { /* 任何额外信息 */ }
      })
      .addCalculationMeta({
        assumptionVersion: assumptionVersion.id,
        engineVersion: `your-calculator@${this.ENGINE_VERSION}`,
        executedAt: new Date(),
        executionTimeMs: Date.now() - startTime,
        intermediateValues: {
          // 关键中间变量（用于调试和审计）
          keyStep1: 123,
          keyStep2: 456
        }
      })
      .addRegulatoryCompliance("相关标准") // 如 IEC xxx
      .build();
    
    // 5. 构建结果
    return new ResultBuilder(
      calculationData,
      "your-calculator",
      this.ENGINE_VERSION,
      "STANDARD" // 或 AUDIT_GRADE
    )
      .setEvidence(evidence)
      .setReproduceCommand({
        endpoint: "/api/v1/your/calculate",
        method: "POST",
        body: params,
        expectedHash: "",
        assumptionVersion: assumptionVersion.id
      })
      .build();
  }
  
  private static performCalculation(params, data, standards) {
    // 你的计算逻辑
    // 使用 standards.xxxCalculation 中的标准参数
    return {
      someMetric: 100,
      otherMetric: 200
    };
  }
  
  private static async fetchData(params) {
    // 获取外部数据
    return {
      source: "Some API",
      cached: false,
      data: { /* ... */ }
    };
  }
}
```

### 步骤4：在API中使用

```typescript
// app/api/v1/your/calculate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { YourCalculatorV2 } from '@/lib/calculator/your-calculator-v2';
import { ResultValidator } from '@/lib/kernel/calculation-result';

export async function POST(req: NextRequest) {
  try {
    const params = await req.json();
    
    // 执行计算（自动包含证据链等）
    const result = await YourCalculatorV2.calculate(params);
    
    // 验证结果完整性（可选但推荐）
    const validation = ResultValidator.validate(result);
    if (!validation.valid) {
      console.warn("Result validation warnings:", validation.warnings);
    }
    
    // 返回
    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
```

---

## 📊 质量等级使用指南

### 三种质量等级

| 等级 | 场景 | 要求 | 示例 |
|------|------|------|------|
| **PREVIEW** | 快速预览、初步估算 | 基本数据完整 | 用户在页面上快速试算 |
| **STANDARD** | 常规使用、常规决策 | 完整证据链+口径 | 项目可研、内部决策 |
| **AUDIT_GRADE** | 银行贷款、政府审批 | +不确定性分析+合规 | 投资审批、贷款申请 |

### 如何选择质量等级？

```typescript
// 规则：根据使用场景
function chooseQualityTag(context): QualityTag {
  if (context.purpose === "银行贷款" || context.purpose === "政府审批") {
    return "AUDIT_GRADE"; // 最高质量
  }
  
  if (context.purpose === "项目可研" || context.hasStakeholders) {
    return "STANDARD"; // 标准质量
  }
  
  return "PREVIEW"; // 快速预览
}
```

---

## 🔍 调试与验证

### 验证证据链完整性

```typescript
import { EvidenceBuilder } from '@/lib/kernel/evidence-chain';

const evidence = new EvidenceBuilder('test-id')
  .addSolarResource({ /* ... */ })
  .addCalculationMeta({ /* ... */ });

// 验证before build
const validation = evidence.validate();
console.log(validation);
// {
//   valid: false,
//   completeness: 0.67,
//   missingFields: ["uncertaintyAnalysis"],
//   warnings: ["建议添加不确定性分析以提升可信度"]
// }
```

### 验证结果完整性

```typescript
import { ResultValidator } from '@/lib/kernel/calculation-result';

const result = await SolarCalculatorV2.calculate(params);

const validation = ResultValidator.validate(result);
if (!validation.valid) {
  console.error("验证失败:", validation.errors);
}

console.log("完整性:", validation);
// {
//   valid: true,
//   errors: [],
//   warnings: []
// }
```

### 验证结果是否被篡改

```typescript
const hashValid = ResultValidator.recalculateHash(result) === result.auditMeta.hash;
console.log("哈希校验:", hashValid ? "通过 ✅" : "失败 ❌(数据可能被篡改)");
```

---

## 💡 常见问题

### Q1: 我必须使用这套架构吗？

**A**: 新功能强制使用，旧功能逐步迁移。

**原因**：
- 这是"护城河"的核心
- 通用AI越强，我们越需要这套差异化系统
- 企业客户要求审计级质量

### Q2: 这会增加很多开发工作量吗？

**A**: 初期略增（~20%代码），但价值巨大。

**对比**：
```typescript
// 旧方式：30行
function oldCalculate(params) {
  const result = doCalculation(params);
  return result; // 简单但价值低
}

// 新方式：~60行（模板化后会更快）
function newCalculate(params) {
  // ... 构建证据链
  // ... 添加元数据
  // ... 标准化输出
  return result; // 代码多但价值高：可审计、可交付、可信任
}
```

**回报**：
- 企业客户愿意付费（可用于贷款审批）
- 用户迁移成本高（资产沉淀）
- API调用价值高（带证据链）

### Q3: 如何处理性能问题？

**A**: 分级优化

```typescript
// PREVIEW级：可以牺牲一些精度换速度
if (qualityTag === "PREVIEW") {
  // 使用缓存
  // 简化计算
  // 省略不确定性分析
}

// AUDIT_GRADE：不能牺牲质量
if (qualityTag === "AUDIT_GRADE") {
  // 完整计算
  // 详细证据
  // 完整分析
}
```

### Q4: 口径版本如何管理？

**A**: 类似语义化版本

```typescript
// 当前：v2024.1
// 小变更：v2024.2（参数微调）
// 大 变更：v2025.1（口径重大更新）

// 用户可以选择：
const version = AssumptionManager.getVersion("v2024.1");
// 或者默认使用当前版本：
const version = AssumptionManager.getCurrentVersion();
```

### Q5: 如果数据源API失败怎么办？

**A**: 优雅降级

```typescript
async function fetchSolarResource(location) {
  try {
    // 尝试主数据源
    const data = await fetchFromNASA(location);
    return {
      source: "NASA POWER",
      data,
      cacheHit: false
    };
  } catch (error) {
    // 降级到备用数据源
    const data = await fetchFromOpenMeteo(location);
    return {
      source: "Open-Meteo",
      data,
      cacheHit: false,
      metadata: { 
        fallback: true,
        primaryError: error.message 
      }
    };
  }
}
```

证据链会记录实际使用的数据源，保证透明。

---

## 📚 推荐学习路径

### Day 1: 理解核心概念
1. ✅ 阅读 `docs/ARCHITECTURE_V1.1_ULTIMATE_MOAT.md`
2. ✅ 理解三层架构
3. ✅ 理解七道壁垒

### Day 2: 查看代码实现
1. ✅ 阅读 `lib/kernel/assumption-manager.ts`
2. ✅ 阅读 `lib/kernel/evidence-chain.ts`
3. ✅ 阅读 `lib/kernel/calculation-result.ts`

### Day 3: 学习示例
1. ✅ 研究 `lib/calculator/solar-v2.ts`
2. ✅ 理解完整流程
3. ✅ 运行测试代码

### Day 4: 动手实践
1. ✅ 创建一个简单的计算器
2. ✅ 集成证据链
3. ✅ 验证结果

### Day 5: 生产应用
1. ✅ 重构现有模块
2. ✅ 集成到API
3. ✅ 编写测试

---

## 🎯 下一步

1. **查看实施进度**：`docs/ULTIMATE_MOAT_IMPLEMENTATION_PROGRESS.md`
2. **Study示例代码**：`src/lib/calculator/solar-v2.ts`
3. **开始重构**：选择一个模块，按模板改造
4. **测试验证**：确保证据链完整、结果可复现

---

## 💬 需要帮助？

- 📖 完整文档：`docs/ARCHITECTURE_V1.1_ULTIMATE_MOAT.md`
- 📊 进度报告：`docs/ULTIMATE_MOAT_IMPLEMENTATION_PROGRESS.md`
- 🔧 示例代码：`src/lib/calculator/solar-v2.ts`
- 🧪 测试模板：即将添加

---

**记住核心原则**：

> 通用AI能"算"，  
> 新能源智库能"交付"。  
>   
> 我们不只给答案，  
> 我们给的是可信的、可审计的、可签字的"系统级交付物"。  
>   
> 这才是真正的护城河。

---

*文档更新：2026-02-03*  
*适用版本：v1.1 Ultimate Moat*  
*难度：⭐⭐⭐ (需要理解架构思想)*
