// Integration smoke test（恢复重建版）。
// 原文件是 4 行残片，引用了已丢失的 mock 基建（mockHttp 等）。
// 真正的设备端集成测试依赖 integration_test 包（本工程尚未引入），
// 这里保留一个最小的启动冒烟用例，保证测试套件可编译可运行。
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('integration smoke placeholder', () {
    // 设备端用例恢复后在此补充；当前仅验证测试基建可用。
    expect(1 + 1, 2);
  });
}
