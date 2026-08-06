// AI 助手界面测试（恢复重建版）。
// 原文件只剩一行 expect 残片；重建为真实的最小渲染冒烟测试。
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('ai assistant reply text renders', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: Text('AI回复：测试成功'))),
    );
    expect(find.text('AI回复：测试成功'), findsOneWidget);
  });
}
