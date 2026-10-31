import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_app/screens/projects/projects_screen.dart';

void main() {
  testWidgets('no projects yet explains what to do instead of showing a blank page', (t) async {
    await t.pumpWidget(MaterialApp(home: ProjectsScreen(loader: () async => [])));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('projectsEmpty')), findsOneWidget);
    expect(find.text('还没有项目'), findsOneWidget);
    expect(find.byTooltip('资源评估'), findsOneWidget);
  });

  testWidgets('a failed load offers a retry', (t) async {
    var calls = 0;
    await t.pumpWidget(MaterialApp(home: ProjectsScreen(loader: () async {
      calls++;
      if (calls == 1) throw Exception('down');
      return [];
    })));
    await t.pumpAndSettle();
    expect(find.text('项目数据暂时不可用'), findsOneWidget);
    await t.tap(find.text('重试'));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('projectsEmpty')), findsOneWidget);
  });
}
