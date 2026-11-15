// 复测 B23：答案有没有来源依据，必须在答案最上面说，而不是埋在底部。
// 服务端每次回答都带 grounding.status（sourced / no_source / no_source_refused）；以前 App 完全不读它，
// 没有来源时只在卡片底部有一行小字，上面照样是自信的「Bottom line」。
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_global/screens/ai_assistant/ai_assistant_screen.dart';

Map<String, dynamic> _reply(Map<String, dynamic>? grounding) => {
      'message': 'Bottom line: IRR is about 8.5%.',
      'structured': {'headline': 'IRR is about 8.5%.', 'key_numbers': [], 'basis': [], 'risks': [], 'glossary': [], 'limitations': []},
      if (grounding != null) 'grounding': grounding,
    };

Future<void> _ask(WidgetTester t, Map<String, dynamic> reply) async {
  await t.pumpWidget(MaterialApp(home: AiAssistantScreen(chat: (m, s) async => reply)));
  await t.enterText(find.byKey(const Key('aiInput')), 'q');
  await t.tap(find.byKey(const Key('aiSend')));
  await t.pumpAndSettle();
}

void main() {
  testWidgets('no source: the status is the first thing in the answer card, above the conclusion', (t) async {
    await _ask(t, _reply({'status': 'no_source', 'source_count': 0}));
    expect(find.byKey(const Key('groundingStatus')), findsOneWidget);
    expect(find.text('No library source behind this answer. Check any figures yourself.'), findsOneWidget);
    final status = t.getTopLeft(find.byKey(const Key('groundingStatus'))).dy;
    expect(status, lessThan(t.getTopLeft(find.byKey(const Key('answerHeadline'))).dy));
    // nothing sits above it inside the card
    expect(status, lessThanOrEqualTo(t.getTopLeft(find.byKey(const Key('answerCard'))).dy + 15));
  });

  testWidgets('refused policy question says it was not answered, in the error colour', (t) async {
    await _ask(t, _reply({'status': 'no_source_refused', 'source_count': 0}));
    expect(find.text('Not answered: our library has no source for this question.'), findsOneWidget);
    final icon = t.widget<Icon>(find.descendant(of: find.byKey(const Key('groundingStatus')), matching: find.byType(Icon)));
    expect(icon.icon, Icons.block);
  });

  testWidgets('sourced answer shows how many library sources stand behind it', (t) async {
    await _ask(t, _reply({'status': 'sourced', 'source_count': 2}));
    expect(find.text('Based on 2 sources from our library'), findsOneWidget);
    await _ask(t, _reply({'status': 'sourced', 'source_count': 1}));
    expect(find.text('Based on 1 source from our library'), findsOneWidget);
  });

  testWidgets('replies from an older server (no grounding) show no banner', (t) async {
    await _ask(t, _reply(null));
    expect(find.byKey(const Key('groundingStatus')), findsNothing);
  });

  testWidgets('status also leads when the reply has no structured card', (t) async {
    await _ask(t, {'message': 'Bottom line: IRR is about 8.5%.', 'grounding': {'status': 'no_source', 'source_count': 0}});
    expect(find.byKey(const Key('groundingStatus')), findsOneWidget);
  });

  testWidgets('retest N02: an expired deadline is flagged inside the answer card, not only in the raw text', (t) async {
    await _ask(t, {
      ..._reply({'status': 'sourced', 'source_count': 1}),
      'time_check': {'today': '2026-11-01', 'expired_dates': [{'date': '2026-07-04'}, {'date': '2025-09-02'}]},
    });
    expect(find.byKey(const Key('dateCheck')), findsOneWidget);
    expect(find.text('Date check: 2026-07-04 and 2025-09-02 have already passed (today is 2026-11-01). Do not read them as future deadlines.'), findsOneWidget);
  });

  testWidgets('no expired date, no date-check banner', (t) async {
    await _ask(t, {
      ..._reply({'status': 'sourced', 'source_count': 1}),
      'time_check': {'today': '2026-11-01', 'expired_dates': []},
    });
    expect(find.byKey(const Key('dateCheck')), findsNothing);
  });
}
