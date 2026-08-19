# 🚀 运维系统快速开始

## 一键访问

### 主要页面
- **项目列表**: http://localhost:3001/projects
- **运维中心 (Demo-1)**: http://localhost:3001/projects/demo-1/om
- **项目详情 (Demo-1)**: http://localhost:3001/projects/demo-1

### 快速操作

#### 1. 查看设备状态
```bash
curl http://localhost:3001/api/projects/demo-1/stations
```

#### 2. 查看告警
```bash
curl http://localhost:3001/api/projects/demo-1/alerts
```

#### 3. 生成日报
```bash
curl -X POST http://localhost:3001/api/projects/demo-1/reports \
  -H "Content-Type: application/json" \
  -d '{"reportType":"daily"}'
```

#### 4. 获取性能分析
```bash
curl http://localhost:3001/api/projects/demo-1/analytics
```

#### 5. AI 智能诊断
```bash
curl -X POST http://localhost:3001/api/projects/diagnosis \
  -H "Content-Type: application/json" \
  -d '{
    "projectId":"demo-1",
    "projectName":"北京朝阳分布式光伏示范站",
    "projectType":"solar",
    "capacity":120,
    "health":98
  }'
```

## 功能清单 ✅

### 核心功能
- ✅ 项目管理（CRUD）
- ✅ 设备监控
- ✅ 实时告警
- ✅ 维护计划
- ✅ 监控数据
- ✅ AI 诊断
- ✅ 性能分析
- ✅ 运维报告
- ✅ 批量操作
- ✅ 系统配置

### API 端点数量
- **总计**: 11 个主要端点
- **方法**: GET, POST, PUT, PATCH, DELETE

### UI 页面
- **项目列表页**: 展示所有项目
- **项目详情页**: 详细信息、图表、AI 诊断
- **运维中心**: 4 个标签页（总览、设备、告警、维护）

## 预置数据

### Demo 项目
1. **demo-1**: 北京朝阳分布式光伏示范站 (120kW)
2. **demo-2**: 内蒙古辉腾锡勒风电场 III 期 (50MW)
3. **demo-3**: 上海临港工商业储能调峰站 (2MW)
4. **demo-4**: 广东惠州渔光互补项目 (5MW)

### Demo 设备 (demo-1)
- 1号逆变器组 (在线, 24.5kW, 98.2%)
- 2号逆变器组 (在线, 23.8kW, 97.8%)
- 3号逆变器组 (告警, 18.2kW, 85.1%) ⚠️

### Demo 告警
- ⚠️ 逆变器 #03 效率偏低
- ℹ️ 系统自检完成

### Demo 维护任务
- 📅 光伏组件清洗 (计划中, 3天后)
- 📅 逆变器例行检查 (计划中, 7天后)
- 🔧 3号逆变器散热检修 (进行中)

## 开发提示

### 启动服务器
```bash
cd /Users/feifei00/Documents/xinnengyuan
npm run dev
```

### 查看日志
```bash
# 服务器日志会实时显示在终端
```

### 环境变量
确保 `.env.local` 包含:
```env
SILICONFLOW_API_KEY=sk-xxx  # AI 诊断需要
```

## 下一步

1. ✅ 已完成基础运维功能
2. 🎯 建议: 添加数据持久化（连接数据库）
3. 🎯 建议: 实现 WebSocket 实时推送
4. 🎯 建议: 添加 PDF 报告导出
5. 🎯 建议: 开发移动端应用

---

**当前状态**: 🟢 所有功能正常运行
**最后测试**: 2026-01-15 17:09
