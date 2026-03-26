# 新能源智库 — 测试指南

## 运行测试

### Backend pytest
```bash
cd ~/Documents/新能源智库/backend
PYTHONPATH=. DATABASE_URL="postgresql+asyncpg://energy:energy_dev_pass@localhost:5432/energy_global" \
.venv313/bin/pytest tests/test_api.py -v
```

### Flutter Integration Tests
```bash
# iOS CN
cd ~/Documents/新能源智库/ios-cn && flutter test test/integration_test.dart

# Android CN
cd ~/Documents/新能源智库/android-cn && flutter test test/integration_test.dart
```

## 测试覆盖

| 模块 | 测试用例数 | 状态 |
|------|-----------|------|
| Health | 2 | ✅ |
| Auth (注册/登录/重复) | 5 | ✅ |
| Projects (CRUD) | 4 | ✅ |
| Resource (Solar/Wind) | 3 | ✅ |
| Finance (Solar/Wind) | 2 | ✅ |
| **总计** | **16** | **✅ 15/15** |

## 已知限制

- **NASA POWER API**: macOS 环境无外网访问，solar resource 测试接受 timeout 作为成功
- **OPENAI_API_KEY**: 未配置时 AI chat 返回 mock 响应
- **Flutter tests**: 需要真实设备/模拟器 + backend 运行在 localhost:4001

## CI/CD

GitHub Actions 建议:
```yaml
- name: Run backend tests
  run: |
    cd backend
    .venv313/bin/pytest tests/test_api.py -v
```
