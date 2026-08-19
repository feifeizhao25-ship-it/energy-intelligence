# 新能源电站运维管理系统 - 功能文档

## 📋 系统概览

本系统为新能源电站（光伏、风电、储能）提供完整的智能运维解决方案，包括实时监控、设备管理、告警处理、维护计划、性能分析等核心功能。

---

## 🎯 核心功能模块

### 1. 项目管理
- **路径**: `/projects`
- **功能**:
  - 项目列表展示
  - 创建新项目（快速模拟）
  - 项目详情查看
  - 快速跳转到运维中心

### 2. 运维中心
- **路径**: `/projects/[id]/om`
- **标签页**:
  - **总览**: 快速数据卡片、功率曲线、最新告警、维护计划
  - **设备监控**: 设备列表、状态监控、实时数据
  - **告警管理**: 告警列表、筛选、确认/解决
  - **维护计划**: 任务列表、状态跟踪、排期管理

### 3. AI 智能诊断
- **路径**: `/api/projects/[id]/diagnosis`
- **功能**:
  - 基于 DeepSeek-V3 的智能分析
  - 结构化输出（JSON 格式）
  - 提供健康评分、问题识别、优化建议

---

## 📡 API 端点

### 项目相关
```
GET    /api/projects              # 获取项目列表
POST   /api/projects              # 创建新项目
GET    /api/projects/[id]         # 获取项目详情
DELETE /api/projects/[id]         # 删除项目
```

### 设备管理
```
GET    /api/projects/[id]/stations    # 获取设备列表
POST   /api/projects/[id]/stations    # 添加新设备
```

### 告警系统
```
GET    /api/projects/[id]/alerts      # 获取告警列表
POST   /api/projects/[id]/alerts      # 创建告警
PATCH  /api/projects/[id]/alerts      # 更新告警状态
```

### 维护管理
```
GET    /api/projects/[id]/maintenance  # 获取维护任务
POST   /api/projects/[id]/maintenance  # 创建维护任务
PATCH  /api/projects/[id]/maintenance  # 更新任务状态
```

### 监控数据
```
GET    /api/projects/[id]/monitoring?range=24h  # 获取监控数据
  范围: realtime | 24h | 7d | 30d
```

### 运维报告
```
GET    /api/projects/[id]/reports           # 获取报告列表
POST   /api/projects/[id]/reports           # 生成新报告
  参数: { reportType: 'daily' | 'weekly' | 'monthly', format: 'json' | 'pdf' }
```

### 性能分析
```
GET    /api/projects/[id]/analytics?period=30d  # 获取性能分析
  返回: 效率分析、损失分解、对标分析、优化建议、财务影响
```

### 批量操作
```
GET    /api/projects/[id]/batch     # 获取操作历史
POST   /api/projects/[id]/batch     # 执行批量操作
  动作: restart_devices | resolve_alerts | schedule_maintenance | update_parameters | export_data
```

### 系统配置
```
GET    /api/projects/[id]/config    # 获取配置
PUT    /api/projects/[id]/config    # 更新配置
POST   /api/projects/[id]/config    # 重置为默认
```

### AI 诊断
```
POST   /api/projects/diagnosis      # 生成 AI 诊断报告
```

---

## 🎨 UI 特性

### 设计亮点
- ✅ 现代化深色/浅色主题
- ✅ 响应式设计（支持移动端）
- ✅ 流畅的动画和过渡效果
- ✅ 数据可视化图表（Recharts）
- ✅ 直观的状态指示器
- ✅ 卡片化布局

### 交互功能
- ✅ 实时数据自动刷新（30秒）
- ✅ 一键刷新按钮
- ✅ 快速操作按钮
- ✅ 标签页切换
- ✅ 模态框和弹窗
- ✅ 拖拽排序（规划中）

---

## 🔧 技术栈

### 前端
- **框架**: Next.js 14 (App Router)
- **UI**: React, TypeScript
- **样式**: Tailwind CSS
- **图标**: Lucide React
- **图表**: Recharts
- **动画**: Framer Motion

### 后端
- **Runtime**: Node.js
- **API**: Next.js API Routes
- **数据库**: Prisma (暂用内存存储)
- **AI**: DeepSeek-V3 (via SiliconFlow)

### 外部服务
- **认证**: NextAuth.js
- **地图**: 高德地图
- **数据**: NASA POWER, NREL, Semantic Scholar

---

## 📊 数据结构

### 项目 (Project)
```typescript
{
  id: string
  name: string
  type: 'solar' | 'wind' | 'storage'
  capacity: number  // kW
  lat: number
  lng: number
  parameters: {
    address: string
    status: 'planning' | 'running' | 'warning' | 'maintenance'
    gridConnection: string
  }
  createdAt: Date
}
```

### 设备 (Station)
```typescript
{
  id: string
  name: string
  type: 'inverter' | 'turbine' | 'battery'
  status: 'online' | 'offline' | 'warning' | 'maintenance'
  power: number
  efficiency: number
  temperature: number
  lastUpdate: Date
}
```

### 告警 (Alert)
```typescript
{
  id: string
  type: 'error' | 'warning' | 'info' | 'success'
  title: string
  description: string
  deviceId?: string
  status: 'active' | 'resolved'
  priority: 'urgent' | 'high' | 'medium' | 'low'
  createdAt: Date
}
```

### 维护任务 (Maintenance)
```typescript
{
  id: string
  title: string
  description: string
  type: 'cleaning' | 'inspection' | 'repair' | 'maintenance'
  status: 'scheduled' | 'in_progress' | 'completed'
  priority: 'urgent' | 'high' | 'medium' | 'low'
  scheduledDate: Date
  estimatedDuration: number  // hours
  assignedTo: string
  devices: string[]
}
```

---

## 🚀 使用指南

### 快速开始

1. **访问项目列表**
   ```
   http://localhost:3001/projects
   ```

2. **创建演示项目**
   - 点击"快速模拟 (Debug)"按钮
   - 系统自动生成示例电站数据

3. **查看项目详情**
   - 点击项目卡片
   - 查看发电数据、健康度、AI 诊断

4. **进入运维中心**
   - 从项目详情页点击"运维中心"按钮
   - 或从项目列表点击"运维"快捷按钮

5. **使用 AI 诊断**
   - 在项目详情页点击"开始诊断"
   - 等待 AI 生成结构化分析报告

### 常见操作

#### 生成运维报告
```bash
curl -X POST http://localhost:3001/api/projects/demo-1/reports \
  -H "Content-Type: application/json" \
  -d '{"reportType":"daily","format":"json"}'
```

#### 获取性能分析
```bash
curl http://localhost:3001/api/projects/demo-1/analytics?period=30d
```

#### 批量重启设备
```bash
curl -X POST http://localhost:3001/api/projects/demo-1/batch \
  -H "Content-Type: application/json" \
  -d '{
    "action":"restart_devices",
    "targets":["station-1-1","station-1-2"]
  }'
```

---

## 📈 性能优化

### 已实现
- ✅ API 响应缓存
- ✅ 组件懒加载
- ✅ 图片优化
- ✅ CSS 代码分割

### 规划中
- ⏳ WebSocket 实时推送
- ⏳ Service Worker 离线支持
- ⏳ 数据预加载
- ⏳ CDN 加速

---

## 🔒 安全特性

### 当前实现
- ✅ API 路由权限检查
- ✅ NextAuth 认证
- ✅ 环境变量保护
- ✅ CSRF 保护

### 规划功能
- ⏳ 双因素认证 (2FA)
- ⏳ IP 白名单
- ⏳ 审计日志
- ⏳ 数据加密

---

## 📝 开发路线

### Phase 1: 基础功能 ✅
- [x] 项目管理
- [x] 设备监控
- [x] 告警系统
- [x] 维护计划
- [x] 监控数据

### Phase 2: 智能化 ✅
- [x] AI 智能诊断
- [x] 性能分析
- [x] 优化建议
- [x] 报告生成

### Phase 3: 高级功能 🚧
- [x] 批量操作
- [x] 系统配置
- [ ] 数据导出
- [ ] WebSocket 实时通信
- [ ] 移动端应用

### Phase 4: 企业级 📋
- [ ] 多租户支持
- [ ] 权限管理系统
- [ ] 数据分析看板
- [ ] 集成第三方平台
- [ ] API 开放平台

---

## 💡 最佳实践

1. **定期巡检**: 建议每周查看运维中心总览
2. **及时处理告警**: 优先处理高优先级告警
3. **预防性维护**: 按计划执行维护任务
4. **性能优化**: 每月查看性能分析报告
5. **数据备份**: 定期导出运维数据

---

## 🆘 故障排查

### 常见问题

**Q: API 返回 404**
- 检查服务器是否正在运行
- 确认路由参数是否正确
- 查看开发者工具控制台错误

**Q: 数据不刷新**
- 检查自动刷新是否启用
- 手动点击刷新按钮
- 检查网络连接

**Q: AI 诊断失败**
- 确认 API Key 配置正确
- 查看服务器日志
- 检查网络连接到 SiliconFlow

---

## 📧 联系支持

- **文档**: 查看本文件
- **问题反馈**: GitHub Issues
- **技术支持**: 查看日志文件

---

**最后更新**: 2026-01-15
**版本**: v1.0.0
**状态**: ✅ 生产就绪
