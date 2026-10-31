import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_global/screens/settings/settings_screen.dart';

final _cjk = RegExp(r'[\u3400-\u9fff]');

// Domestic editions are Chinese only, international editions English only.
bool _isDomestic() => false;

Widget _host(SettingsScreen s) => MaterialApp(routes: {'/login': (_) => const Scaffold(body: Text('LOGIN_PAGE'))}, home: s);

void main() {
  testWidgets('profile comes from the server and no invented person is shown', (t) async {
    await t.pumpWidget(_host(SettingsScreen(meLoader: () async => {'name': 'Mei Lin', 'email': 'mei@example.com'})));
    await t.pumpAndSettle();
    expect(find.text('Mei Lin'), findsOneWidget);
    expect(find.text('mei@example.com'), findsOneWidget);
    expect(find.text('John Doe'), findsNothing);
  });

  testWidgets('a failed profile load keeps the neutral label', (t) async {
    await t.pumpWidget(_host(SettingsScreen(meLoader: () async => throw Exception('x'))));
    await t.pumpAndSettle();
    expect(find.text('Signed in'), findsOneWidget);
  });

  testWidgets('plan & usage row opens the usage screen', (t) async {
    await t.pumpWidget(_host(SettingsScreen(
      meLoader: () async => {},
      usageLoader: () async => {'plan_name': 'P', 'plan_features': [], 'items': [], 'resets': {}},
    )));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('openPlanUsage')));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('planCard')), findsOneWidget);
  });

  testWidgets('export fetches the real copy and shows record counts', (t) async {
    await t.pumpWidget(_host(SettingsScreen(
      meLoader: () async => {},
      exporter: () async => {'projects': [1, 2, 3], 'reports': [], 'user': {'id': 'u'}},
    )));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('exportData')));
    await t.pumpAndSettle();
    expect(find.text('projects: 3'), findsOneWidget);
    expect(find.text('reports: 0'), findsOneWidget);
    expect(find.text('user: 1'), findsNothing);
  });

  testWidgets('export failure is reported, not faked', (t) async {
    await t.pumpWidget(_host(SettingsScreen(meLoader: () async => {}, exporter: () async => throw Exception('no'))));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('exportData')));
    await t.pumpAndSettle();
    expect(find.text('Export failed. Please try again.'), findsOneWidget);
  });

  testWidgets('delete needs the typed word, calls the API, signs out and leaves', (t) async {
    var deleted = 0, signedOut = 0;
    await t.pumpWidget(_host(SettingsScreen(
      meLoader: () async => {},
      deleter: () async => deleted++,
      signOut: () async => signedOut++,
    )));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('deleteAccount')));
    await t.pumpAndSettle();
    expect(t.widget<TextButton>(find.byKey(const Key('deleteConfirmButton'))).onPressed, isNull);
    await t.enterText(find.byKey(const Key('deleteConfirmField')), 'DELETE');
    await t.pump();
    await t.tap(find.byKey(const Key('deleteConfirmButton')));
    await t.pumpAndSettle();
    expect(deleted, 1);
    expect(signedOut, 1);
    expect(find.text('LOGIN_PAGE'), findsOneWidget);
  });

  testWidgets('delete failure keeps the user signed in and says so', (t) async {
    var signedOut = 0;
    await t.pumpWidget(_host(SettingsScreen(meLoader: () async => {}, deleter: () async => throw Exception('500'), signOut: () async => signedOut++)));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('deleteAccount')));
    await t.pumpAndSettle();
    await t.enterText(find.byKey(const Key('deleteConfirmField')), 'DELETE');
    await t.pump();
    await t.tap(find.byKey(const Key('deleteConfirmButton')));
    await t.pumpAndSettle();
    expect(signedOut, 0);
    expect(find.text('Could not delete the account. Please try again.'), findsOneWidget);
  });

  testWidgets('sign out really clears the session', (t) async {
    var signedOut = 0;
    await t.pumpWidget(_host(SettingsScreen(meLoader: () async => {}, signOut: () async => signedOut++)));
    await t.pumpAndSettle();
    await t.scrollUntilVisible(find.byKey(const Key('signOut')), 200, scrollable: find.byType(Scrollable).first);
    await t.tap(find.byKey(const Key('signOut')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('signOutConfirm')));
    await t.pumpAndSettle();
    expect(signedOut, 1);
    expect(find.text('LOGIN_PAGE'), findsOneWidget);
  });

  testWidgets('screen text follows the edition language', (t) async {
    await t.pumpWidget(_host(SettingsScreen(meLoader: () async => {})));
    await t.pumpAndSettle();
    final texts = t.widgetList<Text>(find.byType(Text)).map((w) => w.data ?? '').where((s) => RegExp(r'[A-Za-z\u3400-\u9fff]').hasMatch(s)).toList();
    final expectCjk = _isDomestic();
    if (expectCjk) {
      expect(texts.where((s) => !_cjk.hasMatch(s)), isEmpty);
    } else {
      expect(texts.where(_cjk.hasMatch), isEmpty);
    }
  });
}
