import 'package:energy_app/screens/operations/operations_screen.dart';
import 'package:energy_app/screens/operations/health_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('运维诊断入口：横幅 + 三张照片卡片，每张都能打开真实页面', (t) async {
    await t.binding.setSurfaceSize(const Size(420, 1400));
    addTearDown(() => t.binding.setSurfaceSize(null));
    await t.pumpWidget(const MaterialApp(home: OperationsScreen()));
    expect(find.text('让电站持续高效发电'), findsOneWidget);
    expect(find.text('电站健康诊断'), findsOneWidget);
    expect(find.text('发电异常检测'), findsOneWidget);
    expect(find.text('清洗决策优化'), findsOneWidget);
    expect(find.textContaining('即将'), findsNothing); // 不放没做好的入口
    expect(find.textContaining('Coming soon'), findsNothing);
    await t.tap(find.text('电站健康诊断'));
    await t.pump();
    await t.pump(const Duration(milliseconds: 400));
    expect(find.byType(HealthScreen), findsOneWidget);
  });
}
