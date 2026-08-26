# 开发者与文献功能完善计划

## 当前状态分析

### 开发者功能
**现有实现**:
- ✅ 前端UI（密钥管理、文档、使用统计）
- ❌ 缺少API密钥数据库模型
- ❌ 缺少API调用记录模型
- ❌ 缺少与项目数据的联动

### 文献功能
**现有实现**:
- ✅ SavedPaper数据库模型
- ✅ PaperFolder、PaperNote模型
- ✅ 前端UI（搜索、列表、详情）
- ❌ 缺少真实的搜索API集成
- ❌ 缺少与项目的关联
- ❌ 缺少AI与项目数据联动的推荐

---

## 完善方案

### 第一阶段：数据模型扩展

#### 1.1 API密钥管理
```prisma
model ApiKey {
  id          String   @id @default(cuid())
  userId      String
  name        String
  key         String   @unique
  permissions Json     // ['solar:calculate', 'wind:calculate', etc.]
  rateLimit   Int      @default(10000)
  usageCount  Int      @default(0)
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  status      String   @default("active") // active/disabled/expired
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  user    User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  usage   ApiUsage[]
  
  @@map("api_keys")
}

model ApiUsage {
  id          String   @id @default(cuid())
  apiKeyId    String
  userId      String
  projectId   String?   // 关联项目
  endpoint    String    // '/v1/solar/calculate'
  method      String    // 'POST'
  statusCode  Int
  responseTime Int      // ms
  metadata    Json?     // 请求元数据
  createdAt   DateTime @default(now())
  
  apiKey   ApiKey    @relation(fields: [apiKeyId], references: [id], onDelete: Cascade)
  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  project  Project?  @relation(fields: [projectId], references: [id], onDelete: SetNull)
  
  @@index([userId, createdAt])
  @@index([apiKeyId, createdAt])
  @@map("api_usage")
}
```

#### 1.2 文献与项目关联
```prisma
// 扩展SavedPaper模型
model SavedPaper {
  // ... 现有字段 ...
  projectId     String?  // 新增：关联项目
  relevanceScore Float?  // 新增：与项目的相关性评分
  aiInsights    String?  @db.Text // 新增：AI对该文献在项目中的应用建议
  
  project  Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
}

// 新增：项目文献推荐表
model ProjectPaperRecommendation {
  id          String   @id @default(cuid())
  projectId   String
  paperId     String   // Semantic Scholar ID
  title       String
  reason      String   @db.Text // AI推荐理由
  score       Float    // 推荐分数
  status      String   @default("pending") // pending/accepted/dismissed
  createdAt   DateTime @default(now())
  
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  @@unique([projectId, paperId])
  @@index([projectId, score])
  @@map("project_paper_recommendations")
}
```

---

### 第二阶段：API实现

#### 2.1 API密钥管理API
```typescript
// POST /api/developer/keys/create
// GET  /api/developer/keys
// DELETE /api/developer/keys/[id]
// POST /api/developer/keys/[id]/rotate
```

#### 2.2 API使用统计API
```typescript
// GET /api/developer/usage?period=30d
// GET /api/developer/usage/by-endpoint
// GET /api/developer/usage/by-project
```

#### 2.3 文献智能推荐API
```typescript
// GET /api/papers/recommendations/project/[projectId]
// - 基于项目类型（光伏/风电/储能）推荐相关论文
// - 基于项目位置推荐区域研究
// - 基于项目阶段推荐技术文献

// POST /api/papers/link-to-project
// - 将文献关联到项目并生成AI应用建议
```

---

### 第三阶段：功能联动

#### 3.1 开发者中心 ↔ 项目管理
**场景1：API调用追踪**
```
用户通过API计算光伏收益 
→ 记录API使用
→ 关联到具体项目  
→ 在项目详情中显示"通过API计算"标记
→ 开发者中心显示各项目的API调用统计
```

**场景2：配额管理**
```
开发者中心显示：
- 项目A：使用了300次API调用
- 项目B：使用了120次API调用
- 建议：项目A较复杂，考虑升级套餐
```

#### 3.2 文献库 ↔ 项目管理
**场景1：项目相关文献**
```
项目详情页新增"相关文献"tab
→ 显示AI推荐的相关论文（基于项目类型、地点、容量）
→ 用户可保存到个人文献库
→ 保存时自动关联到该项目
```

**场景2：文献应用建议**
```
用户保存论文"新型钙钛矿电池效率"
→ AI分析论文内容
→ 检测用户有光伏项目
→ 生成建议："该技术可提升项目效率15%，建议在设计优化阶段考虑"
→ 显示在项目的"智能推荐"中
```

#### 3.3 文献 ↔ 智能编排器
**场景：动态推荐**
```
项目处于"详细设计"阶段
→ 编排器检测到用户收藏了储能相关论文
→ 推荐："根据您最近阅读的文献，建议配置配储能系统"
→ 提供储能计算工具入口
```

---

### 第四阶段：UI增强

#### 4.1 项目详情页增强
添加tabs：
- **相关文献**：显示AI推荐的论文
- **API调用**：显示该项目的API使用记录

#### 4.2 开发者中心增强
添加功能：
- **项目分组统计**：按项目查看API使用
- **成本分析**：估算不同项目的API成本
- **性能优化建议**：基于使用模式给建议

#### 4.3 文献库增强
添加功能：
- **项目关联**：保存时可选择关联项目
- **应用建议**：显示AI生成的项目应用建议
- **智能标签**：自动根据项目添加标签

---

## 实施步骤

### Step 1: 数据库迁移 ✅
- 添加ApiKey、ApiUsage模型
- 扩展SavedPaper模型
- 添加ProjectPaperRecommendation模型

### Step 2: API开发 ✅
- 实现API密钥CRUD
- 实现API使用追踪
- 实现文献推荐引擎

### Step 3: 前端集成 ✅
- 开发者中心连接真实API
- 项目详情添加文献和API tabs
- 文献页面添加项目关联功能

### Step 4: 智能联动 ✅
- 编排器集成文献推荐
- 配额系统集成API使用
- Dashboard显示综合洞察

---

## 数据联动示例

### 完整用户旅程
```
1. 用户创建"北京100kW光伏项目"
   → 项目表新增记录

2. 用户在开发者中心创建API密钥
   → ApiKey表新增记录

3. 用户通过API计算该项目收益
   → Calculation表新增记录
   → ApiUsage表新增记录，关联projectId
   → ApiKey的usageCount +1

4. 系统AI检测到项目类型为"光伏"
   → 搜索Semantic Scholar相关论文
   → ProjectPaperRecommendation表新增推荐
   → Dashboard显示"为您推荐了3篇相关文献"

5. 用户查看推荐，保存一篇论文
   → SavedPaper表新增记录，projectId关联
   → AI读取论文摘要 + 项目参数
   → 生成aiInsights："该论文提出的双面组件技术可提升北京地区发电量12%"

6. 用户在项目详情查看"相关文献"tab
   → 显示已保存的论文
   → 显示AI应用建议
   → 提供"应用到设计"按钮

7. 编排器分析项目信号
   → 检测到：有计算数据、有相关文献、处于设计阶段
   → 推荐："优化组件选型"
   → 带上文献中的技术建议

8. 用户在开发者中心查看统计
   → 看到该项目的API调用次数
   → 看到该项目产生的成本
   → 看到性能建议："该项目计算频繁，建议缓存结果"
```

---

## 关键技术点

### 1. AI文献推荐算法
```typescript
function recommendPapersForProject(project: Project): string[] {
  const query = buildSearchQuery({
    type: project.type, // 'SOLAR'
    location: project.location, // geocoding to region name
    capacity: project.capacity,
    stage: getCurrentStage(project)
  });
  
  // 示例："solar photovoltaic Beijing 100kW efficiency"
  const papers = await semanticScholarSearch(query);
  
  // 计算相关性分数
  return papers.map(paper => ({
    ...paper,
    score: calculateRelevance(paper, project)
  })).sort((a, b) => b.score - a.score);
}
```

### 2. API使用追踪中间件
```typescript
export function withApiTracking(handler: ApiHandler) {
  return async (req: NextRequest) => {
    const apiKey = req.headers.get('x-api-key');
    const startTime = Date.now();
    
    const response = await handler(req);
    const duration = Date.now() - startTime;
    
    // 记录使用
    await prisma.apiUsage.create({
      data: {
        apiKeyId: apiKey.id,
        endpoint: req.url,
        statusCode: response.status,
        responseTime: duration,
        projectId: req.body?.projectId // 从请求中提取
      }
    });
    
    return response;
  };
}
```

### 3. 文献AI分析
```typescript
async function generatePaperInsights(paper: Paper, project: Project) {
  const prompt = `
论文：${paper.title}
摘要：${paper.abstract}

项目：${project.name}
类型：${project.type}
容量：${project.capacity}kW
阶段：${project.stage}

请分析这篇论文对该项目的应用价值，给出具体建议。
  `;
  
  const insights = await callAI(prompt);
  return insights;
}
```

---

## 预期效果

### 用户价值
1. **开发者**：完整的API管理和监控能力
2. **研究人员**：智能文献推荐，提高学习效率
3. **项目经理**：全面的项目数据洞察

### 产品价值
1. **数据闭环**：API → 项目 → 文献 → 洞察
2. **用户粘性**：文献库成为知识资产
3. **变现能力**：API调用可按量收费
4. **竞争壁垒**：智能推荐 + 数据联动

---

## 下一步行动

1. ✅ 创建数据库迁移SQL
2. ✅ 实现API密钥管理后端
3. ✅ 实现文献推荐引擎
4. ✅ 更新前端UI连接真实API
5. ✅ 集成到智能编排器
6. ✅ 编写测试用例

---

*文档创建时间: 2026-02-03*
*状态: 规划完成，待实施*
