import 'package:flutter/material.dart';
import 'package:flutter_math_fork/flutter_math.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_global_ios/widgets/ai_message_body.dart';

const bool zh = false;
const noSrc = zh ? '本回答未检索到可引用的来源，请自行核对。' : 'No source was found for this answer; please verify it yourself.';

final sources = <Map<String, dynamic>>[
  {'title': 'Doc one', 'publisher': 'Org A', 'published_at': '2025-02-09', 'url': 'https://example.org/a', 'freshness_status': 'fresh', 'relevance_score': 0.91},
  {'title': 'Doc two', 'publisher': 'Org B', 'published_at': '2024-01-01', 'url': 'https://example.org/b'},
  {'title': 'Doc three', 'publisher': 'Org C', 'published_at': '2023-05-05'},
];

Widget host(Widget child) => MaterialApp(home: Scaffold(body: SingleChildScrollView(child: child)));

void main() {
  test('tokenize finds math in every delimiter style and citations', () {
    final t = AiMessageBody.tokenize(r'LCOE $$\frac{a}{b}$$ and \(x^2\) or \[y_1\] then $E=mc^2$ [S1] [S3]');
    expect(t.where((e) => e.kind == AiTokenKind.math).map((e) => e.value), [r'\frac{a}{b}', 'x^2', 'y_1', 'E=mc^2']);
    expect(t.where((e) => e.kind == AiTokenKind.math).map((e) => e.display), [true, false, true, false]);
    expect(t.where((e) => e.kind == AiTokenKind.cite).map((e) => e.number), [1, 3]);
  });

  test('currency amounts are not mistaken for math', () {
    final t = AiMessageBody.tokenize(r'It costs $5 to $6 per kW.');
    expect(t.where((e) => e.kind == AiTokenKind.math), isEmpty);
  });

  testWidgets('formulas render as typeset math', (tester) async {
    await tester.pumpWidget(host(AiMessageBody(text: r'LCOE = $\frac{C}{E}$ and $$\sum_{t=0}^{n}\frac{CF_t}{(1+r)^t}$$', sources: const [])));
    expect(find.byType(Math), findsNWidgets(2));
  });

  testWidgets('bad TeX falls back to text instead of crashing', (tester) async {
    await tester.pumpWidget(host(AiMessageBody(text: r'broken $\frac{$ here', sources: const [])));
    expect(tester.takeException(), isNull);
  });

  testWidgets('[S3] becomes a tappable chip that opens the source', (tester) async {
    await tester.pumpWidget(host(AiMessageBody(text: 'Claim one [S1] and claim three [S3].', sources: sources)));
    expect(find.byKey(const ValueKey('ai-cite-S1')), findsOneWidget);
    expect(find.byKey(const ValueKey('ai-cite-S3')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('ai-cite-S3')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('ai-source-sheet')), findsOneWidget);
    expect(find.textContaining('Doc three'), findsWidgets);
  });

  testWidgets('a marker with no matching source is dropped, not shown as a dead chip', (tester) async {
    await tester.pumpWidget(host(AiMessageBody(text: 'Claim [S9].', sources: sources)));
    expect(find.byKey(const ValueKey('ai-cite-S9')), findsNothing);
    expect(find.textContaining('[S9]'), findsNothing);
  });

  testWidgets('source list shows every source; tapping one opens details with the link', (tester) async {
    await tester.pumpWidget(host(AiMessageBody(text: 'Answer.', sources: sources)));
    expect(find.byKey(const ValueKey('ai-source-list')), findsOneWidget);
    expect(find.byKey(const ValueKey('ai-source-1')), findsOneWidget);
    expect(find.byKey(const ValueKey('ai-source-3')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('ai-source-1')));
    await tester.pumpAndSettle();
    expect(find.text('https://example.org/a'), findsOneWidget);
  });

  testWidgets('no sources says so plainly in the app language', (tester) async {
    await tester.pumpWidget(host(AiMessageBody(text: 'Answer without support.', sources: const [])));
    expect(find.byKey(const ValueKey('ai-no-sources')), findsOneWidget);
    expect(find.text(noSrc), findsOneWidget);
    expect(find.byKey(const ValueKey('ai-source-list')), findsNothing);
  });
}
