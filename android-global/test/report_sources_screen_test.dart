import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_global/screens/projects/report_sources_screen.dart';

Widget _host({required ReportSourcesLoader loader, ReportSourcesSaver? saver}) => MaterialApp(
      home: ReportSourcesScreen(projectId: 'p1', projectName: 'Arizona Solar', loader: loader, saver: saver),
    );

final _cjk = RegExp(r'[\u3400-\u9fff]');

void main() {
  testWidgets('shows a spinner while loading', (t) async {
    final never = Future<Map<String, dynamic>>.delayed(const Duration(days: 1), () => {});
    await t.pumpWidget(_host(loader: (_) => never));
    expect(find.byKey(const Key('sourcesLoading')), findsOneWidget);
    await t.pumpWidget(const SizedBox());
    await t.pump(const Duration(days: 2));
  });

  testWidgets('load failure shows retry that reloads', (t) async {
    var calls = 0;
    await t.pumpWidget(_host(loader: (_) async {
      calls++;
      if (calls == 1) throw Exception('boom');
      return {'has_financial_model': true, 'sources': []};
    }));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('sourcesError')), findsOneWidget);
    expect(find.text('Could not load. Check your connection and try again.'), findsOneWidget);
    await t.tap(find.text('Retry'));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('sourcesEmpty')), findsOneWidget);
  });

  testWidgets('no financial model explains what to do first', (t) async {
    await t.pumpWidget(_host(loader: (_) async => {'has_financial_model': false, 'sources': []}));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('sourcesNoModel')), findsOneWidget);
    expect(find.text('Save a financial model for this project in the Finance tool first, then come back to add its sources.'), findsOneWidget);
    expect(find.byKey(const Key('addSource')), findsNothing);
  });

  testWidgets('empty state invites the first source; save is disabled until something changes', (t) async {
    await t.pumpWidget(_host(loader: (_) async => {'has_financial_model': true, 'sources': []}));
    await t.pumpAndSettle();
    expect(find.text('No sources yet'), findsOneWidget);
    final save = t.widget<FilledButton>(find.byKey(const Key('saveSources')));
    expect(save.onPressed, isNull);
  });

  testWidgets('existing sources are listed and can be removed, then saved', (t) async {
    List<Map<String, String>>? saved;
    await t.pumpWidget(_host(
      loader: (_) async => {
            'has_financial_model': true,
            'sources': [
              {'title': 'Tariff notice', 'url': 'https://example.gov/a', 'publisher': 'Regulator', 'published_at': '2026-09-01'},
              {'title': 'Grid code', 'url': 'https://example.gov/b'},
            ],
          },
      saver: (id, s) async {
        expect(id, 'p1');
        saved = s;
        return {'count': s.length};
      },
    ));
    await t.pumpAndSettle();
    expect(find.text('Tariff notice'), findsOneWidget);
    expect(find.text('Regulator · 2026-09-01'), findsOneWidget);
    await t.tap(find.byKey(const Key('removeSource0')));
    await t.pumpAndSettle();
    expect(find.text('Tariff notice'), findsNothing);
    await t.tap(find.byKey(const Key('saveSources')));
    await t.pumpAndSettle();
    expect(saved, [
      {'title': 'Grid code', 'url': 'https://example.gov/b'},
    ]);
    expect(find.text('Saved'), findsOneWidget);
  });

  testWidgets('adding validates title and link, then lists the new source', (t) async {
    await t.pumpWidget(_host(loader: (_) async => {'has_financial_model': true, 'sources': []}));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('addSource')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('confirmAdd')));
    await t.pumpAndSettle();
    expect(find.text('Please enter a title'), findsOneWidget);
    expect(find.text('Enter a link that starts with http:// or https://'), findsOneWidget);
    await t.enterText(find.byKey(const Key('fieldTitle')), 'Tariff notice');
    await t.enterText(find.byKey(const Key('fieldLink')), 'javascript:alert(1)');
    await t.tap(find.byKey(const Key('confirmAdd')));
    await t.pumpAndSettle();
    expect(find.text('Enter a link that starts with http:// or https://'), findsOneWidget);
    await t.enterText(find.byKey(const Key('fieldLink')), 'https://example.gov/notice');
    await t.tap(find.byKey(const Key('confirmAdd')));
    await t.pumpAndSettle();
    expect(find.text('Tariff notice'), findsOneWidget);
    expect(find.byKey(const Key('sourcesCount')), findsOneWidget);
    expect(t.widget<FilledButton>(find.byKey(const Key('saveSources'))).onPressed, isNotNull);
  });

  testWidgets('a failed save keeps the edits and says so', (t) async {
    await t.pumpWidget(_host(
      loader: (_) async => {'has_financial_model': true, 'sources': [{'title': 'A', 'url': 'https://a.org'}]},
      saver: (_, _) async => throw Exception('server'),
    ));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('removeSource0')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('saveSources')));
    await t.pumpAndSettle();
    expect(find.text('Could not save. Please try again.'), findsOneWidget);
    expect(t.widget<FilledButton>(find.byKey(const Key('saveSources'))).onPressed, isNotNull);
  });

  testWidgets('every visible string is in the edition language', (t) async {
    await t.pumpWidget(_host(loader: (_) async => {'has_financial_model': true, 'sources': []}));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('addSource')));
    await t.pumpAndSettle();
    final texts = t.widgetList<Text>(find.byType(Text)).map((w) => w.data ?? '').where((s) => RegExp(r'[A-Za-z\u3400-\u9fff]').hasMatch(s));
    for (final s in texts) {
      expect(_cjk.hasMatch(s), false, reason: s);
    }
  });
}
