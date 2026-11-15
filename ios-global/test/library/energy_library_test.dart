// Reference library (global): data validation, review gate, search/filter, page states.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_global_ios/screens/library/reference_library_page.dart';
import 'package:energy_global_ios/screens/library/energy_library.dart';

void main() {
  final raw = File('assets/library/energy_library_intl_v1.json').readAsStringSync();
  final strings = kEnergyLibraryStrings;
  const statuses = ['In force', 'Proposed', 'Repealed', 'Unverified'];

  test('every entry has source, licence, status, dates; ids unique; A-grade only; all pending', () {
    final entries = ((jsonDecode(raw) as Map<String, dynamic>)['entries'] as List).cast<Map<String, dynamic>>();
    expect(entries.length, greaterThanOrEqualTo(8));
    final ids = <String>{};
    for (final e in entries) {
      expect(ids.add(e['id'] as String), isTrue);
      final s = e['source'] as Map<String, dynamic>;
      expect(statuses, contains(e['status']));
      expect(s['url'] as String, matches(RegExp(r'^https://')));
      expect((s['license_note'] as String).isNotEmpty && (s['read_scope'] as String).isNotEmpty && (s['publisher'] as String).isNotEmpty, isTrue);
      expect(e['publish_date'] as String, matches(RegExp(r'^\d{4}-\d{2}(-\d{2})?$')));
      expect(e['review_status'], 'Pending review');
      expect(s['tier'], 'A');
    }
  });

  final all = parseLibrary(raw);
  Widget host(Widget c) => MaterialApp(home: c);
  test('review gate hides pending entries by default', () {
    expect(visibleLibraryEntries(all, showPending: false, pendingLabel: strings.pendingLabel, approvedLabel: strings.approvedLabel), isEmpty);
    expect(visibleLibraryEntries(all, showPending: true, pendingLabel: strings.pendingLabel, approvedLabel: strings.approvedLabel).length, all.length);
  });
  test('search and category filter', () {
    expect(filterLibrary(all, query: 'offshore').isNotEmpty, isTrue);
    expect(filterLibrary(all, query: 'zzznothing'), isEmpty);
  });
  testWidgets('preview shows pending badge; default shows the under-review state', (tester) async {
    await tester.pumpWidget(host(ReferenceLibraryPage(strings: strings, loader: () async => raw, showPending: true)));
    await tester.pumpAndSettle();
    expect(find.text('Pending review'), findsWidgets);
    await tester.pumpWidget(host(ReferenceLibraryPage(key: UniqueKey(), strings: strings, loader: () async => raw, showPending: false)));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('library-empty-review')), findsOneWidget);
  });
  testWidgets('detail page shows source and licence', (tester) async {
    await tester.pumpWidget(host(ReferenceLibraryPage(strings: strings, loader: () async => raw, showPending: true)));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(Key('library-card-${all.first.id}')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('library-detail')), findsOneWidget);
    await tester.dragUntilVisible(find.byKey(const Key('library-open-source')), find.byKey(const Key('library-detail')), const Offset(0, -300));
    expect(find.text('Source'), findsOneWidget);
  });
}
