# 🌐 新能源智库开放 API 文档

## 概述

新能源智库开放 API 允许第三方开发者访问和使用我们的新能源项目数据、监控信息、文献资源等服务。

---

## 🔐 认证方式

### API Key 认证

所有 API 请求需要携带 API Key：

**方式 1: 使用 Header**
```bash
curl https://api.xinnengyuan.ai/v1/projects \
  -H "X-API-Key: your_api_key"
```

**方式 2: 使用 Bearer Token**
```bash
curl https://api.xinnengyuan.ai/v1/projects \
  -H "Authorization: Bearer your_api_key"
```

### 获取 API Key

1. 登录开发者控制台
2. 进入 API Keys 管理页面
3. 点击"创建新 Key"
4. 设置权限和速率限制
5. 保存生成的 Key（只显示一次！）

### Demo API Key

用于测试的演示 Key（只读权限，速率限制 100/min）：
```
xny_pk_demo_1234567890abcdef
```

---

## 📊 API 端点

### 基础 URL

| 环境 | URL |
|------|-----|
| 生产环境 | `https://api.xinnengyuan.ai/v1` |
| 开发环境 | `http://localhost:3001/api/v1` |

---

## 项目 API

### 获取项目列表

```http
GET /projects
```

**参数:**
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| page | integer | 1 | 页码 |
| limit | integer | 20 | 每页数量 (max: 100) |
| type | string | - | 过滤: solar, wind, storage |
| status | string | - | 过滤: running, planning, warning |

**示例:**
```bash
curl 'http://localhost:3001/api/v1/projects?type=solar&limit=10' \
  -H "X-API-Key: xny_pk_demo_1234567890abcdef"
```

**响应:**
```json
{
  "success": true,
  "data": [
    {
      "id": "demo-1",
      "name": "北京朝阳分布式光伏示范站",
      "type": "solar",
      "capacity": 120,
      "capacityUnit": "kW",
      "location": {
        "address": "北京市朝阳区",
        "lat": 39.9219,
        "lng": 116.4434
      },
      "status": "running",
      "createdAt": "2024-12-15T00:00:00Z",
      "metrics": {
        "dailyGeneration": 450,
        "monthlyGeneration": 12500,
        "efficiency": 98.2
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 4,
    "totalPages": 1,
    "hasMore": false
  },
  "meta": {
    "timestamp": "2026-01-16T00:00:00Z",
    "version": "v1"
  }
}
```

---

### 获取项目详情

```http
GET /projects/{id}
```

**示例:**
```bash
curl http://localhost:3001/api/v1/projects/demo-1 \
  -H "X-API-Key: xny_pk_demo_1234567890abcdef"
```

**响应:**
```json
{
  "success": true,
  "data": {
    "id": "demo-1",
    "name": "北京朝阳分布式光伏示范站",
    "description": "位于北京市朝阳区的分布式光伏示范项目",
    "type": "solar",
    "capacity": 120,
    "equipment": {
      "panels": { "count": 400, "type": "单晶硅", "power": 300 },
      "inverters": { "count": 3, "type": "组串式", "power": 40 }
    },
    "metrics": {
      "realtime": { "power": 85.3, "efficiency": 98.2 },
      "daily": { "generation": 450, "peakPower": 115 },
      "cumulative": { "totalGeneration": 125000 }
    },
    "health": {
      "score": 98,
      "status": "excellent"
    }
  }
}
```

---

### 获取监控数据

```http
GET /projects/{id}/monitoring
```

**参数:**
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| range | string | 24h | 时间范围: realtime, 1h, 24h, 7d, 30d |
| interval | string | 1h | 数据间隔: 1m, 5m, 15m, 1h, 1d |

**示例:**
```bash
curl 'http://localhost:3001/api/v1/projects/demo-1/monitoring?range=24h&interval=1h' \
  -H "X-API-Key: xny_pk_demo_1234567890abcdef"
```

**响应:**
```json
{
  "success": true,
  "data": {
    "projectId": "demo-1",
    "range": "24h",
    "interval": "1h",
    "dataPoints": 24,
    "timeSeries": [
      {
        "timestamp": "2026-01-15T00:00:00Z",
        "power": 45.3,
        "efficiency": 96.5,
        "temperature": 42.1,
        "irradiance": 650,
        "voltage": 385.2,
        "current": 120.5
      }
    ],
    "statistics": {
      "power": { "current": 85.3, "max": 115.2, "avg": 65.8 },
      "efficiency": { "current": 98.2, "max": 99.1, "avg": 96.5 }
    }
  }
}
```

---

### 获取性能分析

```http
GET /projects/{id}/analytics
```

**参数:**
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| period | string | 30d | 分析周期: 7d, 30d, 90d, 1y |

**示例:**
```bash
curl 'http://localhost:3001/api/v1/projects/demo-1/analytics?period=30d' \
  -H "X-API-Key: xny_pk_demo_1234567890abcdef"
```

**响应:**
```json
{
  "success": true,
  "data": {
    "projectId": "demo-1",
    "period": "30d",
    "efficiency": {
      "current": 92.5,
      "target": 95.0,
      "trend": "improving"
    },
    "availability": {
      "current": 98.2,
      "downtime": { "totalHours": 13.2 }
    },
    "losses": {
      "total": 9.5,
      "breakdown": [
        { "category": "soiling", "percentage": 3.5 },
        { "category": "inverter", "percentage": 2.3 }
      ]
    },
    "benchmarking": {
      "rank": "top_25_percent"
    },
    "insights": [
      {
        "type": "optimization",
        "priority": "high",
        "title": "组件清洗建议",
        "potentialGain": "2-3% 发电量"
      }
    ]
  }
}
```

---

## 文献 API

### 搜索文献

```http
GET /papers/search
```

**参数:**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| q | string | ✅ | 搜索关键词 |
| page | integer | - | 页码 |
| limit | integer | - | 每页数量 |
| year | integer | - | 年份过滤 |
| sort | string | - | 排序: relevance, citations, year |

**示例:**
```bash
curl 'http://localhost:3001/api/v1/papers/search?q=solar+energy&limit=5' \
  -H "X-API-Key: xny_pk_demo_1234567890abcdef"
```

---

## ⚡ 速率限制

| 计划 | 限制 | 说明 |
|------|------|------|
| 免费 | 60 次/分钟 | 适合测试和小规模使用 |
| 基础 | 300 次/分钟 | 适合中小项目 |
| 专业 | 1000 次/分钟 | 适合企业应用 |
| 企业 | 自定义 | 联系销售 |

**响应头:**
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1768520000000
```

**超限响应 (429):**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "retryAfter": 45
  }
}
```

---

## 🚨 错误处理

### 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

### 错误代码

| 代码 | HTTP 状态 | 描述 |
|------|-----------|------|
| MISSING_API_KEY | 401 | 缺少 API Key |
| INVALID_API_KEY | 401 | 无效的 API Key |
| KEY_EXPIRED | 401 | API Key 已过期 |
| KEY_REVOKED | 401 | API Key 已撤销 |
| INSUFFICIENT_PERMISSIONS | 403 | 权限不足 |
| RATE_LIMIT_EXCEEDED | 429 | 超出速率限制 |
| PROJECT_NOT_FOUND | 404 | 项目不存在 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |

---

## 🔑 权限系统

### 可用权限

| 权限 | 描述 |
|------|------|
| `read:projects` | 读取项目列表和详情 |
| `read:monitoring` | 读取监控数据 |
| `read:analytics` | 读取分析数据 |
| `read:papers` | 读取文献资源 |
| `write:projects` | 创建/修改项目 |
| `*` | 所有权限 |

---

## 📦 SDK 和代码示例

### Python

```python
import requests

API_KEY = "xny_pk_demo_1234567890abcdef"
BASE_URL = "http://localhost:3001/api/v1"

headers = {"X-API-Key": API_KEY}

# 获取项目列表
response = requests.get(f"{BASE_URL}/projects", headers=headers)
projects = response.json()["data"]

# 获取监控数据
response = requests.get(
    f"{BASE_URL}/projects/demo-1/monitoring?range=24h",
    headers=headers
)
monitoring = response.json()["data"]
```

### JavaScript

```javascript
const API_KEY = 'xny_pk_demo_1234567890abcdef';
const BASE_URL = 'http://localhost:3001/api/v1';

async function getProjects() {
  const response = await fetch(`${BASE_URL}/projects`, {
    headers: { 'X-API-Key': API_KEY }
  });
  const data = await response.json();
  return data.data;
}

async function getMonitoring(projectId, range = '24h') {
  const response = await fetch(
    `${BASE_URL}/projects/${projectId}/monitoring?range=${range}`,
    { headers: { 'X-API-Key': API_KEY } }
  );
  return response.json();
}
```

### cURL

```bash
# 获取项目列表
curl http://localhost:3001/api/v1/projects \
  -H "X-API-Key: xny_pk_demo_1234567890abcdef"

# 获取项目详情
curl http://localhost:3001/api/v1/projects/demo-1 \
  -H "X-API-Key: xny_pk_demo_1234567890abcdef"

# 获取监控数据
curl 'http://localhost:3001/api/v1/projects/demo-1/monitoring?range=24h' \
  -H "X-API-Key: xny_pk_demo_1234567890abcdef"

# 搜索文献
curl 'http://localhost:3001/api/v1/papers/search?q=solar+energy' \
  -H "X-API-Key: xny_pk_demo_1234567890abcdef"
```

---

## 📋 API 管理

### 创建 API Key

```bash
curl -X POST http://localhost:3001/api/developer/keys \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Production Key",
    "permissions": ["read:projects", "read:monitoring"],
    "rateLimit": 100
  }'
```

### 查看 API Keys

```bash
curl http://localhost:3001/api/developer/keys
```

### 查看使用统计

```bash
curl http://localhost:3001/api/developer/usage
```

---

## 📖 OpenAPI 文档

获取完整的 OpenAPI 3.0 规范文档：

```bash
# JSON 格式
curl http://localhost:3001/api/v1/docs

# YAML 格式
curl http://localhost:3001/api/v1/docs?format=yaml
```

可导入到 Swagger UI、Postman 等工具中使用。

---

## 🆘 技术支持

- **文档**: https://xinnengyuan.ai/developer/docs
- **状态页面**: https://status.xinnengyuan.ai
- **邮件**: api-support@xinnengyuan.ai
- **工单**: https://xinnengyuan.ai/support

---

**API 版本**: v1.0.0  
**最后更新**: 2026-01-16  
**状态**: 🟢 稳定运行
