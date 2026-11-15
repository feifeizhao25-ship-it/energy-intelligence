import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_app/screens/auth/login_screen.dart';
import 'package:energy_app/screens/auth/register_screen.dart';
import 'package:energy_app/theme/app_theme.dart';

/// iPad / wide screens: login and register cards are capped at 480 and centred (1024 and 1440 wide).
void main() {
  final screens = <String, Widget Function()>{
    'login': () => const LoginScreen(),
    'register': () => const RegisterScreen(),
  };
  for (final width in [1024.0, 1440.0]) {
    for (final e in screens.entries) {
      for (final mode in [ThemeMode.light, ThemeMode.dark]) {
        testWidgets('${e.key} card capped and centred @${width.toInt()} ${mode.name}', (tester) async {
          tester.view.physicalSize = Size(width, 1000);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.reset);
          await tester.pumpWidget(MaterialApp(
            theme: AppTheme.buildTheme(),
            darkTheme: AppTheme.buildDarkTheme(),
            themeMode: mode,
            home: e.value(),
          ));
          await tester.pump();
          final field = tester.getRect(find.byType(TextField).first);
          expect(field.width, lessThanOrEqualTo(480));
          expect(field.width, greaterThan(300));
          expect(field.center.dx, closeTo(width / 2, 1));
          expect(tester.takeException(), isNull);
        });
      }
    }
  }
}
