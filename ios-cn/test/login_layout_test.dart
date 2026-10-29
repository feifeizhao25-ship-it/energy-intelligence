import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_app/main.dart';
import 'package:energy_app/screens/auth/login_screen.dart';
import 'package:energy_app/services/api_service.dart';
import 'package:energy_app/theme/app_theme.dart';

Future<void> pumpLogin(
  WidgetTester tester,
  Size size, {
  double top = 0,
  double bottom = 0,
  double keyboard = 0,
  ThemeMode mode = ThemeMode.light,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  tester.view.padding = FakeViewPadding(top: top, bottom: bottom);
  tester.view.viewPadding = FakeViewPadding(top: top, bottom: bottom);
  tester.view.viewInsets = FakeViewPadding(bottom: keyboard);
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPadding);
  addTearDown(tester.view.resetViewInsets);
  await tester.pumpWidget(MaterialApp(
    key: ValueKey(mode),
    theme: AppTheme.buildTheme(),
    darkTheme: AppTheme.buildDarkTheme(),
    themeMode: mode,
    home: const LoginScreen(),
  ));
  await tester.pump();
}

void main() {
  testWidgets('SE 登录页避开状态栏，按钮下没有大块空白，注册入口可到达', (tester) async {
    await pumpLogin(tester, const Size(375, 667), top: 20);
    expect(tester.takeException(), isNull);
    final logo = tester.getRect(find.byKey(const Key('login-logo')));
    expect(logo.top, greaterThanOrEqualTo(20));
    final button = tester.getRect(find.widgetWithText(ElevatedButton, '登录'));
    final card = tester.getRect(find.byKey(const Key('login-card')));
    expect(card.bottom - button.bottom, lessThan(48));
    await tester.ensureVisible(find.textContaining('立即注册'));
    expect(find.textContaining('立即注册'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('16 Pro 标识在灵动岛安全区之下', (tester) async {
    await pumpLogin(tester, const Size(402, 874), top: 59, bottom: 34);
    final logo = tester.getRect(find.byKey(const Key('login-logo')));
    expect(logo.top, greaterThanOrEqualTo(59));
    expect(tester.takeException(), isNull);
  });

  testWidgets('iPad 登录卡片使用平板宽度', (tester) async {
    await pumpLogin(tester, const Size(1032, 1376), top: 24);
    final card = tester.getSize(find.byKey(const Key('login-card')));
    expect(card.width, greaterThan(640));
    expect(card.width, lessThanOrEqualTo(720));
    expect(tester.takeException(), isNull);
  });

  testWidgets('深色模式卡片不是白色', (tester) async {
    await pumpLogin(tester, const Size(402, 874), mode: ThemeMode.dark);
    final context = tester.element(find.byKey(const Key('login-card')));
    expect(Theme.of(context).brightness, Brightness.dark);
    expect(tester.widget<Card>(find.byKey(const Key('login-card'))).color, const Color(0xFF1E293B));
  });

  testWidgets('键盘遮挡时页面仍可滚动', (tester) async {
    await pumpLogin(tester, const Size(375, 667), top: 20, keyboard: 300);
    expect(tester.takeException(), isNull);
    await tester.ensureVisible(find.text('登录'));
  });

  testWidgets('未配置地址时显示说明而不是白屏', (tester) async {
    await ApiService.init();
    expect(ApiService.configError, isNotNull);
    await tester.pumpWidget(NewEnergyApp(configError: ApiService.configError));
    await tester.pump();
    expect(find.text('还不能连接服务器'), findsOneWidget);
    expect(find.text('登录'), findsNothing);
  });
}
