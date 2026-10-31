import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_global_ios/screens/dashboard/dashboard_screen.dart';

void main() {
  testWidgets('dashboard has a Settings entry that opens /settings (plan & usage lives there)', (tester) async {
    await tester.pumpWidget(MaterialApp(
      routes: {'/settings': (_) => const Scaffold(body: Text('SETTINGS_PAGE'))},
      home: const DashboardScreen(),
    ));
    await tester.pump();
    expect(find.byKey(const Key('openSettings')), findsOneWidget);
    expect(find.byTooltip('Settings'), findsOneWidget);
    await tester.tap(find.byKey(const Key('openSettings')));
    await tester.pumpAndSettle(const Duration(seconds: 1));
    expect(find.text('SETTINGS_PAGE'), findsOneWidget);
  });
}
