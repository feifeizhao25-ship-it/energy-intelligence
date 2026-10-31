// 政策与数据资料库：数据校验 + 审核门禁 + 搜索筛选 + 页面状态。
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_app/screens/library/reference_library_page.dart';
import 'package:energy_app/screens/library/energy_library.dart';

void main() {
  final raw = File('assets/library/energy_library_v1.json').readAsStringSync();
  final strings = kEnergyLibraryStrings;
  const statuses = ['现行', '征求意见稿', '已废止', '待核实'];

  group('数据', () {
    final entries = ((jsonDecode(raw) as Map<String, dynamic>)['entries'] as List).cast<Map<String, dynamic>>();
    test('每条都有出处、文号、状态和日期，id 不重复，只收 A 级来源，全部待审核', () {
      expect(entries.length, greaterThanOrEqualTo(19));
      final ids = <String>{};
      for (final e in entries) {
        expect(ids.add(e['id'] as String), isTrue);
        final s = e['source'] as Map<String, dynamic>;
        expect(statuses, contains(e['status']));
        expect(s['url'] as String, matches(RegExp(r'^https?://')));
        expect((s['publisher'] as String).isNotEmpty && (s['doc_no'] as String).isNotEmpty && (s['read_scope'] as String).isNotEmpty, isTrue);
        expect(e['publish_date'] as String, matches(RegExp(r'^\d{4}-\d{2}(-\d{2})?$')));
        expect(e['retrieved_at'] as String, matches(RegExp(r'^\d{4}-\d{2}-\d{2}$')));
        expect(e['review_status'], '待审核');
        expect(s['tier'], 'A');
        expect((e['points'] as List), isNotEmpty);
      }
    });
    test('没有投资建议用语', () {
      final banned = RegExp(r'(稳赚|推荐买入|保证收益|投资建议)');
      for (final e in entries) {
        expect(banned.hasMatch(jsonEncode({...e, 'caution': '', 'source': '', 'title': ''})), isFalse, reason: e['id'] as String);
      }
    });
  });

  group('门禁、筛选与页面', () {
    final all = parseLibrary(raw);
    Widget host(Widget c) => MaterialApp(home: c);
    test('默认只显示已审核；预览开关才显示待审核', () {
      expect(visibleLibraryEntries(all, showPending: false, pendingLabel: '待审核', approvedLabel: '已审核'), isEmpty);
      expect(visibleLibraryEntries(all, showPending: true, pendingLabel: '待审核', approvedLabel: '已审核').length, all.length);
    });
    test('搜索与分类', () {
      expect(filterLibrary(all, query: '全额保障性收购').isNotEmpty, isTrue);
      expect(filterLibrary(all, query: 'zzz不存在'), isEmpty);
      expect(filterLibrary(all, category: '统计数据').every((e) => e.category == '统计数据'), isTrue);
    });
    testWidgets('预览：显示待审核标记；默认：显示“资料正在审核中”', (tester) async {
      await tester.pumpWidget(host(ReferenceLibraryPage(strings: strings, loader: () async => raw, showPending: true)));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('library-preview-banner')), findsOneWidget);
      expect(find.text('待审核'), findsWidgets);
      await tester.pumpWidget(host(ReferenceLibraryPage(key: UniqueKey(), strings: strings, loader: () async => raw, showPending: false)));
      await tester.pumpAndSettle();
      expect(find.text('资料正在审核中'), findsOneWidget);
      expect(find.byKey(const Key('library-search')), findsNothing);
    });
    testWidgets('搜索无结果、详情页、没有原文打开器时给出复制链接', (tester) async {
      await tester.pumpWidget(host(ReferenceLibraryPage(strings: strings, loader: () async => raw, showPending: true)));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('library-search')), 'zzzz不存在');
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('library-empty-search')), findsOneWidget);
      await tester.enterText(find.byKey(const Key('library-search')), '');
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(Key('library-card-${all.first.id}')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('library-detail')), findsOneWidget);
      await tester.dragUntilVisible(find.byKey(const Key('library-open-source')), find.byKey(const Key('library-detail')), const Offset(0, -300));
      expect(find.text('复制原文链接'), findsOneWidget);
    });
    testWidgets('设置页入口：没有已审核条目时隐藏', (tester) async {
      await tester.pumpWidget(host(Scaffold(body: ReferenceLibraryEntryTile(strings: strings, loader: () async => raw, showPending: false, title: 'a', subtitle: 'b', onTap: () {}))));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('library-entry-tile')), findsNothing);
    });
  });
}
