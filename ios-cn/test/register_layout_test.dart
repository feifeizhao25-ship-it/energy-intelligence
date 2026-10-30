import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_app/screens/auth/register_screen.dart';
import 'package:energy_app/theme/app_theme.dart';

Future<void> pumpRegister(WidgetTester tester, Size size) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(MaterialApp(
    theme: AppTheme.buildTheme(),
    darkTheme: AppTheme.buildDarkTheme(),
    home: const RegisterScreen(),
  ));
  await tester.pump();
}

void main() {
  testWidgets('iPad 注册表单收成单列并居中，不随屏幕拉宽', (tester) async {
    await pumpRegister(tester, const Size(1032, 1376));
    final field = find.byType(TextField).first;
    final box = tester.getRect(field);
    expect(box.width, lessThanOrEqualTo(480));
    expect(box.width, greaterThan(300));
    expect(box.center.dx, closeTo(1032 / 2, 1));
    expect(tester.takeException(), isNull);
  });

  testWidgets('手机上注册表单仍占满屏幕宽度（减去边距）', (tester) async {
    await pumpRegister(tester, const Size(402, 874));
    final box = tester.getRect(find.byType(TextField).first);
    expect(box.width, closeTo(402 - 40, 1));
    expect(tester.takeException(), isNull);
  });
}
