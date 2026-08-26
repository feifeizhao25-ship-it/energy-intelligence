# 📡 完整 API 路由地图

## 项目管理 API

```
📁 /api/projects
├── GET     - 获取项目列表
├── POST    - 创建新项目
│
├── /[id]
│   ├── GET     - 获取项目详情
│   ├── DELETE  - 删除项目
│   │
│   ├── /stations       - 设备管理
│   │   ├── GET     - 获取设备列表
│   │   └── POST    - 添加新设备
│   │
│   ├── /alerts         - 告警系统
│   │   ├── GET     - 获取告警列表 (?status=active|resolved|all)
│   │   ├── POST    - 创建新告警
│   │   └── PATCH   - 更新告警状态
│   │
│   ├── /maintenance    - 维护管理
│   │   ├── GET     - 获取维护任务 (?status=scheduled|in_progress|completed)
│   │   ├── POST    - 创建维护任务
│   │   └── PATCH   - 更新任务状态
│   │
│   ├── /monitoring     - 监控数据
│   │   └── GET     - 获取监控数据 (?range=realtime|24h|7d|30d)
│   │
│   ├── /reports        - 运维报告
│   │   ├── GET     - 获取报告列表
│   │   └── POST    - 生成新报告 (reportType: daily|weekly|monthly)
│   │
│   ├── /analytics      - 性能分析
│   │   └── GET     - 获取性能分析 (?period=7d|30d|90d|1y)
│   │
│   ├── /batch          - 批量操作
│   │   ├── GET     - 获取操作历史
│   │   └── POST    - 执行批量操作
│   │                 (action: restart_devices|resolve_alerts|
│   │                          schedule_maintenance|update_parameters|export_data)
│   │
│   └── /config         - 系统配置
│       ├── GET     - 获取配置
│       ├── PUT     - 更新配置
│       └── POST    - 重置为默认
│
└── /diagnosis      - AI 诊断
    └── POST    - 生成诊断报告
```

## 文献系统 API

```
📁 /api/papers
├── /search         - 文献搜索
│   └── GET     - 搜索文献 (?q=query&limit=20)
│
├── /[id]           - 文献详情
│   └── GET     - 获取文献详细信息
│
├── /graph          - 知识图谱 🆕
│   └── GET     - 生成知识图谱
│                 (?paperId=xxx&depth=2&type=citation|collaboration|topic)
│
└── /research-assistant  - AI 研究助手 🆕
    └── POST    - 执行研究任务
                  (task: summarize|compare|suggest_research|
                         extract_insights|literature_review)
```

## 用户系统 API

```
📁 /api
├── /dashboard      - 个人仪表板 🆕
│   └── GET     - 获取用户综合数据
│
├── /notifications  - 通知中心 🆕
│   ├── GET     - 获取通知列表 (?unreadOnly=true&category=xxx&limit=50)
│   ├── POST    - 创建新通知
│   ├── PATCH   - 更新通知状态 (readAll=true | notificationIds=[])
│   └── DELETE  - 删除通知 (?id=xxx | deleteAll=true)
│
└── /exports        - 数据导出 🆕
    ├── GET     - 获取导出历史
    └── POST    - 创建导出任务
                  (dataType: projects|monitoring|alerts|maintenance|
                            performance_report|calculations
                   format: csv|json|excel)
```

## 认证 API

```
📁 /api/auth
├── /login      - 登录
├── /register   - 注册
├── /logout     - 登出
└── /sms        - 短信验证码
```

---

## 📊 API 统计

### 按模块
- **项目管理**: 11 个端点
- **文献系统**: 4 个端点
- **用户系统**: 3 个端点
- **认证系统**: 4 个端点
- **总计**: 22 个端点

### 按方法
- **GET**: 14 个
- **POST**: 10 个
- **PATCH**: 3 个
- **PUT**: 1 个
- **DELETE**: 2 个

### 状态
- ✅ 已实现: 18 个
- 📋 API完成/UI待开发: 4 个

---

## 🎯 常用场景

### 📊 监控运维
```bash
# 1. 获取项目列表
GET /api/projects

# 2. 查看设备状态
GET /api/projects/demo-1/stations

# 3. 检查告警
GET /api/projects/demo-1/alerts?status=active

# 4. 查看监控数据
GET /api/projects/demo-1/monitoring?range=24h

# 5. 生成日报
POST /api/projects/demo-1/reports
```

### 📚 研究学习
```bash
# 1. 搜索文献
GET /api/papers/search?q=solar+energy

# 2. 查看知识图谱
GET /api/papers/graph?type=citation

# 3. AI 文献总结
POST /api/papers/research-assistant
{
  "task": "summarize",
  "papers": [...]
}

# 4. 生成综述大纲
POST /api/papers/research-assistant
{
  "task": "literature_review",
  "query": "renewable energy"
}
```

### 👤 个人中心
```bash
# 1. 查看仪表板
GET /api/dashboard

# 2. 获取通知
GET /api/notifications?unreadOnly=true

# 3. 导出数据
POST /api/exports
{
  "dataType": "projects",
  "format": "csv"
}

# 4. 标记已读
PATCH /api/notifications
{
  "readAll": true
}
```

---

## 🔗 API 链接关系

```
项目 → 设备 → 告警
  ↓      ↓
  ↓    维护任务
  ↓
 监控数据 → 报告 → 导出
  ↓
性能分析 → 批量操作
  
文献 → 知识图谱
  ↓
AI 研究助手 → 导出

用户 → 仪表板 → 通知
  ↓              ↓
项目统计     ← 告警推送
```

---

## 📝 响应格式标准

### 成功响应
```json
{
  "success": true,
  "data": {
    // 实际数据
  }
}
```

### 错误响应
```json
{
  "success": false,
  "error": "错误信息"
}
```

### 分页响应
```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "hasMore": true
  }
}
```

### 统计响应
```json
{
  "success": true,
  "data": {
    "items": [...],
    "stats": {
      "total": 50,
      "active": 30,
      "inactive": 20
    }
  }
}
```

---

**最后更新**: 2026-01-15
**API 版本**: v1.0
