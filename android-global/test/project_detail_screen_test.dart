import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_global/screens/projects/project_detail_screen.dart';

void main() {
  final cjk = RegExp(r'[\u3400-\u9fff]');
  const project = {
    'id': 'p1',
    'name': 'Arizona Solar Portfolio',
    'technology': 'solar',
    'capacity_mw': 100.0,
    'location': 'Phoenix, Arizona',
    'status': 'draft',
  };

  testWidgets('shows the real project, not a placeholder', (t) async {
    await t.pumpWidget(const MaterialApp(home: ProjectDetailScreen(project: project)));
    expect(find.text('Arizona Solar Portfolio'), findsOneWidget);
    expect(find.text('Solar PV'), findsOneWidget);
    expect(find.text('100 MW'), findsOneWidget);
    expect(find.text('Draft'), findsOneWidget);
    expect(find.textContaining('Delhi'), findsNothing);
    expect(find.textContaining('14.7'), findsNothing);
    expect(find.text('View Full Report'), findsNothing);
  });

  testWidgets('reads the project from route arguments (how the Projects list opens it)', (t) async {
    await t.pumpWidget(MaterialApp(
      routes: {'/project-detail': (_) => const ProjectDetailScreen()},
      home: Builder(
        builder: (c) => TextButton(
          onPressed: () => Navigator.pushNamed(c, '/project-detail', arguments: project),
          child: const Text('go'),
        ),
      ),
    ));
    await t.tap(find.text('go'));
    await t.pumpAndSettle();
    expect(find.text('Arizona Solar Portfolio'), findsOneWidget);
  });

  testWidgets('fields the server did not send are not shown', (t) async {
    await t.pumpWidget(const MaterialApp(home: ProjectDetailScreen(project: {'id': 'p2', 'name': 'Bare project'})));
    expect(find.text('Bare project'), findsOneWidget);
    expect(find.text('Capacity'), findsNothing);
    expect(find.text('Key information'), findsNothing);
  });

  testWidgets('without a project it says what to do', (t) async {
    await t.pumpWidget(const MaterialApp(home: ProjectDetailScreen()));
    expect(find.byKey(const Key('projectDetailEmpty')), findsOneWidget);
  });

  testWidgets('opens the report data-source screen and is English only', (t) async {
    await t.pumpWidget(const MaterialApp(home: ProjectDetailScreen(project: project)));
    for (final w in t.widgetList<Text>(find.byType(Text))) {
      expect(cjk.hasMatch(w.data ?? ''), false, reason: w.data);
    }
    await t.tap(find.byKey(const Key('openReportSources')));
    await t.pump();
    expect(find.text('Report data sources'), findsWidgets);
  });
}
