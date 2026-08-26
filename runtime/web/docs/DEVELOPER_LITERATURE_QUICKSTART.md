# 开发者与文献功能 - 快速使用指南

## 🎯 已完成的核心功能

### 1. 智能文献推荐系统 ✅
自动为项目推荐相关学术论文，基于Semantic Scholar学术数据库。

### 2. 文献项目关联 ✅
将文献与项目绑定，并生成AI应用建议。

### 3. API密钥管理 ✅
完整的开发者API管理系统（当前使用内存存储）。

---

## 📋 下一步操作清单

### 步骤1: 更新Prisma Schema（必需）

打开 `src/prisma/schema.prisma`，在文件末尾（`AuditLog`模型后）添加：

```prisma
// ==================== API 开发者相关模型 ====================

// API密钥表
model ApiKey {
  id          String    @id @default(cuid())
  userId      String
  name        String
  key         String    @unique
  permissions Json      
  rateLimit   Int       @default(10000)
  usageCount  Int       @default(0)
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  status      String    @default("active")
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  user   User       @relation(fields:[userId], references: [id], onDelete: Cascade)
  usage  ApiUsage[]
  
  @@index([userId])
  @@index([status])
  @@map("api_keys")
}

model ApiUsage {
  id           String   @id @default(cuid())
  apiKeyId     String
  userId       String
  projectId    String?
  endpoint     String
  method       String
  statusCode   Int
  responseTime Int
  metadata     Json?
  createdAt    DateTime  @default(now())
  
  apiKey  ApiKey   @relation(fields: [apiKeyId], references: [id], onDelete: Cascade)
  user    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  project Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
  
  @@index([userId, createdAt])
  @@index([apiKeyId, createdAt])
  @@index([projectId])
  @@map("api_usage")
}

model ProjectPaperRecommendation {
  id          String   @id @default(cuid())
  projectId   String
  paperId     String
  title       String
  authors     String[]
  abstract    String?  @db.Text
  year        Int?
  reason      String   @db.Text
  score       Float
  status      String   @default("pending")
  createdAt   DateTime @default(now())
  
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  @@unique([projectId, paperId])
  @@index([projectId, score])
  @@index([status])
  @@map("project_paper_recommendations")
}
```

同时，在对应的关联模型中添加反向关系：

在 `User` 模型的关联关系部分添加：
```prisma
  apiKeys     ApiKey[]
  apiUsage    ApiUsage[]
```

在 `Project` 模型的关联关系部分添加：
```prisma
  apiUsage             ApiUsage[]
  paperRecommendations ProjectPaperRecommendation[]
```

在 `SavedPaper` 模型中添加字段（如果不存在）：
```prisma
  projectId      String?
  relevanceScore Float?
  aiInsights     String?  @db.Text
  
  project  Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
```

### 步骤2: 执行数据库迁移（可选）

如果使用Supabase或其他PostgreSQL数据库：

```bash
# 方式1: 使用提供的SQL文件
psql $DATABASE_URL < prisma/migrations/20260203_developer_literature_integration/migration.sql

# 方式2: 使用Prisma（推荐）
cd /Users/feifei00/Documents/xinnengyuan
npx prisma db push
npx prisma generate
```

### 步骤3: 测试API端点

#### 测试文献推荐API
```bash
# 获取项目的文献推荐
curl http://localhost:3001/api/papers/recommendations/project/YOUR_PROJECT_ID \
  -H "Cookie: next-auth.session-token=YOUR_SESSION"
```

#### 测试文献关联API
```bash
# 将文献关联到项目
curl -X POST http://localhost:3001/api/papers/link-to-project \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION" \
  -d '{
    "paperId": "SEMANTIC_SCHOLAR_PAPER_ID",
    "projectId": "YOUR_PROJECT_ID"
  }'
```

---

## 💡 快速体验

### 在浏览器中测试

1. **创建一个测试项目**
   - 访问 `http://localhost:3001/quick-calc/solar`
   - 输入位置和容量
   - 保存项目

2. **获取项目ID**
   - console.log或从URL中获取

3. **访问推荐API**
   ```
   http://localhost:3001/api/papers/recommendations/project/{项目ID}
   ```

4. **查看返回的论文列表**
   - 包含论文标题、作者、摘要
   - AI生成的推荐理由
   - 相关性评分

---

## 🎨 前端集成建议

### 在项目详情页添加文献Tab

创建 `src/components/project/ProjectLiteratureTab.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { BookOpen,Bookmark } from 'lucide-react';

export function ProjectLiteratureTab({ projectId }: { projectId: string }) {
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRecommendations();
    }, [projectId]);

    async function fetchRecommendations() {
        try {
            const res = await fetch(`/api/papers/recommendations/project/${projectId}`);
            const data = await res.json();
            if (data.success) {
                setRecommendations(data.data.recommendations);
            }
        } catch (error) {
            console.error('Failed to fetch recommendations:', error);
        } finally {
            setLoading(false);
        }
    }

    async function savePaper(paper: any) {
        try {
            const res = await fetch('/api/papers/link-to-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paperId: paper.paperId,
                    projectId,
                }),
            });
            const data = await res.json();
            if (data.success) {
                alert('文献已保存，AI应用建议：\n' + data.data.aiInsights);
            }
        } catch (error) {
            console.error('Failed to save paper:', error);
        }
    }

    if (loading) return <div>加载中...</div>;

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-bold">💡 AI推荐文献</h3>
            {recommendations.map((rec: any) => (
                <div key={rec.paperId} className="bg-white p-6 rounded-xl border">
                    <h4 className="font-bold text-lg mb-2">{rec.title}</h4>
                    <p className="text-sm text-gray-600 mb-2">
                        {rec.authors.join(', ')} · {rec.year}
                    </p>
                    <p className="text-sm mb-3">{rec.abstract?.substring(0, 200)}...</p>
                    <div className="bg-blue-50 p-3 rounded-lg mb-3">
                        <p className="text-sm text-blue-800">
                            <strong>推荐理由：</strong>{rec.reason}
                        </p>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                            相关性: {(rec.score * 100).toFixed(0)}%
                        </span>
                        <button
                            onClick={() => savePaper(rec)}
                            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                        >
                            <Bookmark className="w-4 h-4 inline mr-2" />
                            保存到我的文献库
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
```

---

## 🔍 功能说明

### 文献推荐算法

系统会根据以下维度为项目推荐论文：

**光伏项目**:
- 效率优化相关研究
- 性能衰减与PR分析
- 经济性评估方法

**风电项目**:
- 风机技术进展
- 小型分散式风电
- 经济性分析

**储能项目**:
- 电池储能技术
- 峰谷套利策略
- 系统优化方案

### AI应用建议生成

当文献保存并关联到项目时，系统会：
1. 分析论文标题和摘要
2. 匹配项目类型和参数
3. 生成具体应用场景建议
4. 评估相关性评分

示例输出：
```
该论文探讨了光伏系统效率优化方案，其中提到的技术方法可应用于您的100kW项目。
建议在设计优化阶段参考论文中的组件选型标准和系统配置方案。
该论文发表时间较新，反映了最新的技术趋势和研究成果。
```

---

## 📚 API数据源

### Semantic Scholar

- 全球最大的学术搜索引擎之一
- 2.1亿+论文数据
- 免费API（100请求/5分钟）
- 高质量元数据和引用关系

**API文档**: https://api.semanticscholar.org/api-docs/graph

---

## ⚠️ 注意事项

1. **API限流**: Semantic Scholar有请求限制，系统使用24小时缓存避免重复请求

2. **数据库迁移**: 执行迁移前建议备份数据

3. **AI建议**: 当前使用基于规则的简化版本，未来可接入OpenAI GPT获得更精准建议

4. **内存存储**: 开发者API密钥目前使用内存存储，重启会丢失，建议后续迁移到数据库

---

## 🎯 使用建议

### For 研究人员
1. 创建项目后立即查看文献推荐
2. 保存相关论文到文献库
3. 查看AI应用建议指导项目设计

### For 开发者
1. 在开发者中心创建API密钥
2. 通过API调用核心计算能力
3. 查看API使用统计优化调用策略

### For 项目经理
1. 在项目详情查看所有关联资源
2. 通过文献了解行业最新技术
3. 基于学术研究优化项目方案

---

## 📞 技术支持

如遇问题，请查阅：
- `docs/DEVELOPER_LITERATURE_INTEGRATION.md` - 详细规划
- `docs/DEVELOPER_LITERATURE_IMPLEMENTATION.md` - 实施总结
- `docs/schema_additions.prisma` - Schema更新内容

---

*更新时间: 2026-02-03*  
*版本: v1.0*  
*状态: API完成，待前端集成*
