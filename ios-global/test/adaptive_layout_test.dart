import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_global_ios/main.dart';
import 'package:energy_global_ios/widgets/reading_column.dart';

void main() {
  testWidgets('>= 600 dp uses a side rail (no bottom bar); < 600 keeps the bottom bar', (t) async {
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    t.view.physicalSize = const Size(768, 1024);
    await t.pumpWidget(const MaterialApp(home: MainNavigation()));
    await t.pump(const Duration(milliseconds: 300));
    expect(find.byType(NavigationRail), findsOneWidget);
    expect(find.byKey(const Key('navTab0')), findsNothing);
    await t.tap(find.byKey(const Key('navRail1')));
    await t.pump(const Duration(milliseconds: 300));
    expect(t.widget<NavigationRail>(find.byType(NavigationRail)).selectedIndex, 1);
    t.view.physicalSize = const Size(599, 900);
    await t.pumpWidget(const MaterialApp(home: MainNavigation()));
    await t.pump(const Duration(milliseconds: 300));
    expect(find.byType(NavigationRail), findsNothing);
    expect(find.byKey(const Key('navTab0')), findsOneWidget);
  });

  testWidgets('reading column holds content to 720 dp on a wide window and does nothing on a phone', (t) async {
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    double? w;
    Widget app() => MaterialApp(home: Scaffold(body: ReadingColumn(child: LayoutBuilder(builder: (c, cons) { w = cons.maxWidth; return const SizedBox.expand(); }))));
    t.view.physicalSize = const Size(960, 900);
    await t.pumpWidget(app());
    expect(w, 720);
    t.view.physicalSize = const Size(500, 844);
    await t.pumpWidget(app());
    expect(w, 500);
  });
}

