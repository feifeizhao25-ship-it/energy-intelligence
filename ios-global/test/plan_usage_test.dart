import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_global_ios/screens/settings/plan_usage_screen.dart';

final _cjk = RegExp(r'[\u3400-\u9fff]');

// Domestic editions are Chinese only, international editions English only.
bool _isDomestic() => false;

Map<String, dynamic> _data({int ai = 2, int projects = 1, String level = 'normal'}) => {
      'plan': 'free',
      'plan_name': 'Evaluation',
      'plan_features': ['5 AI interactions per day'],
      'items': [
        {'category': 'ai_queries', 'used': ai, 'limit': 5, 'remaining': 5 - ai, 'usage_ratio': ai / 5, 'warning_level': level, 'period': 'day'},
        {'category': 'report_exports', 'used': 0, 'limit': -1, 'remaining': -1, 'usage_ratio': 0, 'warning_level': 'unlimited', 'period': 'month'},
        {'category': 'projects', 'used': projects, 'limit': 1, 'remaining': 0, 'usage_ratio': 1, 'warning_level': 'blocked', 'period': 'total'},
      ],
      'resets': {'day': '2026-11-01', 'month': '2026-11-01', 'timezone': 'UTC'},
    };

void main() {
  testWidgets('loading then real numbers, reset dates and limit warning', (t) async {
    await t.pumpWidget(MaterialApp(home: PlanUsageScreen(loader: () async => _data())));
    expect(find.byKey(const Key('planUsageLoading')), findsOneWidget);
    await t.pumpAndSettle();
    expect(find.byKey(const Key('planName')), findsOneWidget);
    expect(find.text('Evaluation'), findsOneWidget);
    expect(find.text('2 / 5'), findsOneWidget);
    expect(find.text('Limit reached'), findsOneWidget);
    expect(find.text('Resets tomorrow (UTC date {date})'.replaceAll('{date}', '2026-11-01')), findsOneWidget);
    expect(find.text('0 used · Unlimited'), findsOneWidget);
  });

  testWidgets('a failed load shows a retry that reloads', (t) async {
    var calls = 0;
    await t.pumpWidget(MaterialApp(home: PlanUsageScreen(loader: () async {
      calls++;
      if (calls == 1) throw Exception('down');
      return _data();
    })));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('planUsageError')), findsOneWidget);
    await t.tap(find.text('Retry'));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('planCard')), findsOneWidget);
    expect(calls, 2);
  });

  testWidgets('warning levels use their own wording', (t) async {
    await t.pumpWidget(MaterialApp(home: PlanUsageScreen(loader: () async => _data(ai: 4, level: 'warning'))));
    await t.pumpAndSettle();
    expect(find.text('Over 80% used'), findsOneWidget);
  });

  testWidgets('usage cards are readable by screen readers', (t) async {
    final handle = t.ensureSemantics();
    await t.pumpWidget(MaterialApp(home: PlanUsageScreen(loader: () async => _data())));
    await t.pumpAndSettle();
    expect(find.bySemanticsLabel(RegExp(RegExp.escape('AI questions (per day): 2 / 5'))), findsOneWidget);
    handle.dispose();
  });

  testWidgets('screen text follows the edition language', (t) async {
    await t.pumpWidget(MaterialApp(home: PlanUsageScreen(loader: () async => _data())));
    await t.pumpAndSettle();
    final texts = t.widgetList<Text>(find.byType(Text)).map((w) => w.data ?? w.textSpan?.toPlainText() ?? '');
    final hasCjk = texts.any(_cjk.hasMatch);
    final expectCjk = _isDomestic();
    expect(hasCjk, expectCjk);
    if (!expectCjk) {
      expect(texts.where(_cjk.hasMatch), isEmpty);
    } else {
      // domestic: every visible string with letters contains Chinese, apart from numbers and the plan feature codes
      final latinOnly = texts.where((s) => RegExp(r'[A-Za-z]{3,}').hasMatch(s) && !_cjk.hasMatch(s));
      expect(latinOnly, isEmpty);
    }
  });
}
