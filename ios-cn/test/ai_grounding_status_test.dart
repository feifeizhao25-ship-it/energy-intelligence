// 复测 B23：答案有没有来源依据，必须在答案最上面说，而不是埋在底部。
// 服务端每次回答都带 grounding.status（sourced / no_source / no_source_refused）；以前 App 完全不读它，
// 没有来源时只在卡片底部有一行小字，上面照样是自信的「一句话结论」。
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_app/screens/ai_assistant/ai_assistant_screen.dart';

Map<String, dynamic> _reply(Map<String, dynamic>? grounding) => {
      'message': '结论：内部收益率约 8.5%。',
      'structured': {'headline': '内部收益率约 8.5%。', 'key_numbers': [], 'basis': [], 'risks': [], 'glossary': [], 'limitations': []},
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
    expect(find.text('这条回答没有资料库来源，请自行核对数据。'), findsOneWidget);
    final status = t.getTopLeft(find.byKey(const Key('groundingStatus'))).dy;
    expect(status, lessThan(t.getTopLeft(find.byKey(const Key('answerHeadline'))).dy));
    // nothing sits above it inside the card
    expect(status, lessThanOrEqualTo(t.getTopLeft(find.byKey(const Key('answerCard'))).dy + 15));
  });

  testWidgets('refused policy question says it was not answered, in the error colour', (t) async {
    await _ask(t, _reply({'status': 'no_source_refused', 'source_count': 0}));
    expect(find.text('未作答：资料库没有收录这个问题的来源。'), findsOneWidget);
    final icon = t.widget<Icon>(find.descendant(of: find.byKey(const Key('groundingStatus')), matching: find.byType(Icon)));
    expect(icon.icon, Icons.block);
  });

  testWidgets('sourced answer shows how many library sources stand behind it', (t) async {
    await _ask(t, _reply({'status': 'sourced', 'source_count': 2}));
    expect(find.text('依据资料库 2 条来源'), findsOneWidget);
    await _ask(t, _reply({'status': 'sourced', 'source_count': 1}));
    expect(find.text('依据资料库 1 条来源'), findsOneWidget);
  });

  testWidgets('replies from an older server (no grounding) show no banner', (t) async {
    await _ask(t, _reply(null));
    expect(find.byKey(const Key('groundingStatus')), findsNothing);
  });

  testWidgets('status also leads when the reply has no structured card', (t) async {
    await _ask(t, {'message': '结论：内部收益率约 8.5%。', 'grounding': {'status': 'no_source', 'source_count': 0}});
    expect(find.byKey(const Key('groundingStatus')), findsOneWidget);
  });

  testWidgets('retest N02: an expired deadline is flagged inside the answer card, not only in the raw text', (t) async {
    await _ask(t, {
      ..._reply({'status': 'sourced', 'source_count': 1}),
      'time_check': {'today': '2026-11-01', 'expired_dates': [{'date': '2026-07-04'}, {'date': '2025-09-02'}]},
    });
    expect(find.byKey(const Key('dateCheck')), findsOneWidget);
    expect(find.text('日期核对：2026-07-04、2025-09-02 已经过去（今天是 2026-11-01），不要当作未来的截止日期。'), findsOneWidget);
  });

  testWidgets('no expired date, no date-check banner', (t) async {
    await _ask(t, {
      ..._reply({'status': 'sourced', 'source_count': 1}),
      'time_check': {'today': '2026-11-01', 'expired_dates': []},
    });
    expect(find.byKey(const Key('dateCheck')), findsNothing);
  });
}
