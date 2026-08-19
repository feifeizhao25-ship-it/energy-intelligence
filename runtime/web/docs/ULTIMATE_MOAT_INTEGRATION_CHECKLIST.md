# 终极护城河 - 集成实施清单

## 📋 立即可执行的任务

### ✅ 已完成（100%）
- [x] 核心架构设计
- [x] 口径管理系统 (`assumption-manager.ts`)
- [x] 证据链系统 (`evidence-chain.ts`)
- [x] 可复现结果格式 (`calculation-result.ts`)
- [x] Solar Calculator V2
- [x] Wind Calculator V2
- [x] Storage Calculator V2
- [x] 数据库Schema设计
- [x] API集成示例
- [x] 完整文档体系

---

## 🔧 待集成任务（按优先级）

### 优先级 P0：核心集成（本周完成）

#### 1. 数据库迁移
```bash
# 执行SQL迁移
cd /Users/feifei00/Documents/xinnengyuan
psql $DATABASE_URL < prisma/migrations/20260203_ultimate_moat_core/migration.sql

# 或使用Prisma（需先更新schema.prisma）
npx prisma db push
npx prisma generate
```

**检查点**：
- [ ] 所有新表创建成功
- [ ] 触发器正常工作
- [ ] 视图可查询
- [ ] 初始口径版本已插入

#### 2. 更新Prisma Schema
在 `src/prisma/schema.prisma` 中添加：

```prisma
model AssumptionVersion {
  id              String   @id
  name            String
  effectiveDate   DateTime @map("effective_date")
  standards       Json
  changelog       String?
  deprecated      Boolean  @default(false)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@map("assumption_versions")
}

model EvidenceChain {
  id                   String   @id
  conclusionId         String   @map("conclusion_id")
  dataProvenance       Json     @map("data_provenance")
  calculationMeta      Json     @map("calculation_meta")
  uncertaintyAnalysis  Json?    @map("uncertainty_analysis")
  referencePapers      Json?    @map("reference_papers")
  regulatoryCompliance String[] @map("regulatory_compliance")
  createdAt            DateTime @default(now()) @map("created_at")

  calculationResults CalculationResult[]

  @@index([conclusionId])
  @@map("evidence_chains")
}

model CalculationResult {
  id                String        @id
  userId            String?       @map("user_id")
  projectId         String?       @map("project_id")
  resultType        String        @map("result_type")
  resultData        Json          @map("result_data")
  auditMeta         Json          @map("audit_meta")
  evidenceChainId   String        @map("evidence_chain_id")
  reproduceCommand  Json          @map("reproduce_command")
  deliverables      Json?
  qualityTag        String        @map("quality_tag")
  createdAt         DateTime      @default(now()) @map("created_at")

  user          User?          @relation(fields: [userId], references: [id], onDelete: SetNull)
  project       Project?       @relation(fields: [projectId], references: [id], onDelete: SetNull)
  evidenceChain EvidenceChain? @relation(fields: [evidenceChainId], references: [id])

  @@index([userId, createdAt])
  @@index([projectId, createdAt])
  @@index([resultType, createdAt])
  @@index([qualityTag])
  @@map("calculation_results")
}

model ProjectTimeline {
  id                String   @id
  projectId         String   @map("project_id")
  milestoneType     String   @map("milestone_type")
  title             String
  summary           String?
  artifactId        String?  @map("artifact_id")
  evidenceChainId   String?  @map("evidence_chain_id")
  deliverables      Json?
  executorType      String   @map("executor_type")
  executorId        String?  @map("executor_id")
  aiModel           String?  @map("ai_model")
  assumptionVersion String?  @map("assumption_version")
  impact            Json?
  tags              String[]
  createdAt         DateTime @default(now()) @map("created_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, createdAt])
  @@index([milestoneType, createdAt])
  @@map("project_timeline")
}

model StandardReport {
  id                String   @id
  userId            String?  @map("user_id")
  projectId         String?  @map("project_id")
  reportType        String   @map("report_type")
  cover             Json
  executiveSummary  Json     @map("executive_summary")
  detailedAnalysis  Json     @map("detailed_analysis")
  evidenceAppendix  Json     @map("evidence_appendix")
  compliance        Json
  metadata          Json
  pdfUrl            String?  @map("pdf_url")
  excelUrl          String?  @map("excel_url")
  jsonUrl           String?  @map("json_url")
  createdAt         DateTime @default(now()) @map("created_at")

  user    User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  project Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt])
  @@index([projectId, createdAt])
  @@index([reportType, createdAt])
  @@map("standard_reports")
}

// 添加到User模型
model User {
  // ... 现有字段
  calculationResults CalculationResult[]
  standardReports    StandardReport[]
}

// 添加到Project模型
model Project {
  // ... 现有字段
  calculationResults CalculationResult[]
  timeline           ProjectTimeline[]
  standardReports    StandardReport[]
  timelineExportable Boolean?  @map("timeline_exportable") @default(true)
  lastTimelineExport DateTime? @map("last_timeline_export")
}
```

**检查点**：
- [ ] Schema更新无错误
- [ ] Relations正确配置
- [ ] Prisma generate成功

#### 3. 集成到现有API
更新现有API路由使用V2计算器：

```typescript
// src/app/api/solar/calculate/route.ts
import { SolarCalculatorV2 } from '@/lib/calculator/solar-v2';

export async function POST(req: Request) {
  // 保持向后兼容
  const useV2 = req.headers.get('X-Use-V2') === 'true';
  
  if (useV2) {
    const result = await SolarCalculatorV2.calculate(params);
    return NextResponse.json(result);
  }
  
  // 旧版逻辑（逐步废弃）
  // ...
}
```

**检查点**：
- [ ] 旧API继续工作
- [ ] 新V2 API可选启用
- [ ] 逐步迁移用户

---

### 优先级 P1：功能增强（下周）

#### 4. 实现Diagnostic V2
重构诊断模块使用证据链：

```typescript
// src/lib/maintenance/diagnostic-v2.ts
export class DiagnosticEngineV2 {
  static async diagnose(
    stationData: MonitoringData,
    qualityTag: QualityTag = "STANDARD"
  ) {
    // 1. 获取口径
    const standards = AssumptionManager.getCurrentVersion();
    
    // 2. 执行诊断
    const diagnostic = this.performDiagnosis(stationData, standards);
    
    // 3. 构建证据链
    const evidence = new EvidenceBuilder(`diag-${Date.now()}`)
      .addMonitoringData({...})
      .addCalculationMeta({...})
      .build();
    
    // 4. 返回标准格式
    return new ResultBuilder(diagnostic, "diagnostic", "2.0.0", qualityTag)
      .setEvidence(evidence)
      .build();
  }
}
```

**检查点**：
- [ ] 诊断结果可追溯
- [ ] PR阈值使用口径版本
- [ ] 证据链包含监测数据来源

#### 5. 添加Report Generator
实现标准化报告生成：

```typescript
// src/lib/reports/generator.ts
export class ReportGenerator {
  static async generateInvestmentReport(
    calculationResult: CalculationResult
  ): Promise<StandardReport> {
    // 加载模板
    const template = await loadTemplate('investment-analysis');
    
    // 填充数据
    const report = {
      cover: {...},
      executiveSummary: {...},
      detailedAnalysis: {...},
      evidenceAppendix: calculationResult.evidence,
      compliance: {...}
    };
    
    // 生成PDF
    const pdfUrl = await generatePDF(report);
    
    // 保存到数据库
    return prisma.standardReport.create({...});
  }
}
```

**检查点**：
- [ ] PDF生成功能
- [ ] 报告模板系统
- [ ] 证据附件页

---

### 优先级 P2：用户体验（2周后）

#### 6. Frontend集成
在项目详情页显示证据链：

```typescript
// components/project/CalculationResultCard.tsx
export function CalculationResultCard({ result }: Props) {
  return (
    <Card>
      <CardHeader>
        <Badge>{result.auditMeta.qualityTag}</Badge>
        <span>口径版本: {result.auditMeta.assumptionVersion}</span>
      </CardHeader>
      
      <CardContent>
        <ResultMetrics data={result.result} />
        
        <Accordion>
          <AccordionItem title="证据链">
            <EvidenceChainView evidence={result.evidence} />
          </AccordionItem>
          
          <AccordionItem title="不确定性分析">
            <UncertaintyView analysis={result.evidence.uncertaintyAnalysis} />
          </AccordionItem>
        </Accordion>
      </CardContent>
      
      <CardFooter>
        <Button onClick={() => downloadReport(result.id)}>
          下载审计报告
        </Button>
      </CardFooter>
    </Card>
  );
}
```

**检查点**：
- [ ] 质量标签可见
- [ ] 证据链展开查看
- [ ] 报告下载功能

#### 7. 项目Timeline展示
```typescript
// components/project/TimelineView.tsx
export function ProjectTimelineView({ projectId }: Props) {
  const timeline = useProjectTimeline(projectId);
  
  return (
    <Timeline>
      {timeline.map(milestone => (
        <TimelineItem
          key={milestone.id}
          type={milestone.milestoneType}
          title={milestone.title}
          summary={milestone.summary}
          impact={milestone.impact}
          evidence={milestone.evidenceChainId}
          date={milestone.createdAt}
        />
      ))}
    </Timeline>
  );
}
```

**检查点**：
- [ ] 时间线可视化
- [ ] 里程碑交互
- [ ] 影响量化展示

---

## 🧪 测试清单

### 单元测试
```bash
# 测试assumption-manager
npm test src/lib/kernel/assumption-manager.test.ts

# 测试evidence-chain
npm test src/lib/kernel/evidence-chain.test.ts

# 测试calculation-result
npm test src/lib/kernel/calculation-result.test.ts
```

**待创建测试文件**：
- [ ] `kernel/assumption-manager.test.ts`
- [ ] `kernel/evidence-chain.test.ts`
- [ ] `kernel/calculation-result.test.ts`
- [ ] `calculator/solar-v2.test.ts`
- [ ] `calculator/wind-v2.test.ts`
- [ ] `calculator/storage-v2.test.ts`

### 集成测试
```typescript
// tests/integration/v2-calculator.test.ts
describe('V2 Calculator Integration', () => {
  it('should calculate solar with evidence chain', async () => {
    const result = await SolarCalculatorV2.calculate({...});
    
    expect(result.evidence).toBeDefined();
    expect(result.auditMeta.hash).toBeDefined();
    
    const validation = ResultValidator.validate(result);
    expect(validation.valid).toBe(true);
  });
  
  it('should verify result hash', async () => {
    const result = await SolarCalculatorV2.calculate({...});
    const recalculated = ResultValidator.recalculateHash(result);
    
    expect(recalculated).toBe(result.auditMeta.hash);
  });
});
```

**检查点**：
- [ ] 所有计算器通过测试
- [ ] 哈希验证正确
- [ ] 证据链完整

---

## 📊 性能优化

### 缓存策略
```typescript
// lib/cache/calculator-cache.ts
export class CalculatorCache {
  // 缓存计算结果（基于参数哈希）
  static async getCached(params: any): Promise<CalculationResult | null> {
    const paramsHash = hashParams(params);
    return redis.get(`calc:${paramsHash}`);
  }
  
  static async setCached(params: any, result: CalculationResult) {
    const paramsHash = hashParams(params);
    // 缓存24小时
    await redis.setex(`calc:${paramsHash}`, 86400, JSON.stringify(result));
  }
}
```

**检查点**：
- [ ] 相同参数命中缓存
- [ ] 缓存失效策略
- [ ] 缓存命中率监控

---

## 📈 监控指标

### 需要追踪的指标
```typescript
// lib/metrics/tracker.ts
export function trackCalculation(result: CalculationResult) {
  metrics.increment('calculation.count', {
    type: result.resultType,
    qualityTag: result.auditMeta.qualityTag,
    assumptionVersion: result.auditMeta.assumptionVersion
  });
  
  metrics.histogram('calculation.duration', 
    result.evidence.calculationMeta.executionTimeMs
  );
  
  if (result.evidence.uncertaintyAnalysis) {
    metrics.gauge('calculation.confidence', 
      result.evidence.uncertaintyAnalysis.confidenceLevel
    );
  }
}
```

**关键指标**：
- [ ] 计算次数（按类型/质量分组）
- [ ] 平均执行时间
- [ ] 质量标签分布
- [ ] 证据链完整性率
- [ ] 哈希验证通过率

---

## 🚀 部署检查

### 环境变量
```bash
# .env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Feature flags
ENABLE_V2_CALCULATORS=true
ENABLE_EVIDENCE_CHAIN=true
ENABLE_AUDIT_LOGGING=true

# Quality requirements
DEFAULT_QUALITY_TAG=STANDARD
REQUIRE_AUDIT_GRADE_AUTH=true
```

### 数据库索引优化
```sql
-- 确保关键查询有索引
EXPLAIN ANALYZE 
SELECT * FROM calculation_results 
WHERE user_id = 'xxx' 
ORDER BY created_at DESC 
LIMIT 10;

-- 如果慢，添加索引
CREATE INDEX CONCURRENTLY idx_calc_user_created 
ON calculation_results(user_id, created_at DESC);
```

**检查点**：
- [ ] 所有查询<100ms
- [ ] 索引覆盖常用查询
- [ ] 无全表扫描

---

## 📝 文档更新

### 对外API文档
更新 `docs/OPEN_API.md`：

```markdown
## POST /api/v2/solar/calculate

**新增V2版本，支持证据链和质量分级**

### Request
\`\`\`json
{
  "location": {...},
  "capacity": 100,
  "qualityTag": "AUDIT_GRADE"  // NEW
}
\`\`\`

### Response
\`\`\`json
{
  "result": {...},
  "auditMeta": {
    "assumptionVersion": "v2024.1",
    "hash": "a3f2b8c4..."
  },
  "evidence": {
    "dataProvenance": {...},
    "uncertaintyAnalysis": {...}
  }
}
\`\`\`
```

**检查点**：
- [ ] API文档更新
- [ ] Swagger/OpenAPI spec
- [ ] 使用示例

---

## ✅ 最终验收标准

### Phase 1 完成条件
- [x] 核心模块实现
- [x] 三大计算器重构
- [x] 数据库Schema
- [x] API示例
- [x] 完整文档

### Phase 1 验收条件
- [ ] 数据库迁移成功
- [ ] 至少一个API使用V2
- [ ] 单元测试覆盖>80%
- [ ] 性能无退化
- [ ] 团队培训完成

---

## 🎯 下周目标

1. ✅ 完成数据库迁移
2. ✅ 集成Solar V2到生产API
3. ✅ 编写基础测试
4. ✅ 性能基准测试
5. ✅ 团队code review

---

**当前状态**: 🟢 Phase 1代码完成，待集成  
**下一里程碑**: Phase 1验收（预计2026-02-05）  
**风险**: 🟡 数据库迁移需要停机维护  
**建议**: 在低峰期执行迁移

---

*清单创建时间: 2026-02-03 09:00*  
*维护者: 开发团队*  
*更新频率: 每日*
