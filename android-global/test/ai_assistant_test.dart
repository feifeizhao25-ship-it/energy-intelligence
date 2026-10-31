import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_global/screens/ai_assistant/ai_assistant_screen.dart';
import 'package:energy_global/services/api_service.dart';

final _cjk = RegExp(r'[\u3400-\u9fff]');

// Domestic editions are Chinese only, international editions English only.
bool _isDomestic() => false;

Map<String, dynamic> _answer() => {
      'message': 'Bottom line: IRR is about 8.5%.',
      'structured': {
        'style': 'plain',
        'headline': 'IRR is about 8.5%.',
        'key_numbers': [
          {'value': '8.5%', 'label': 'IRR'},
        ],
        'basis': [
          {'ref': 'S1', 'title': 'NREL ATB', 'publisher': 'NREL', 'published_at': '2025', 'url': 'https://atb.nrel.gov'},
        ],
        'risks': ['The tariff assumption may change.'],
        'glossary': [
          {'term': 'IRR', 'plain': 'Internal rate of return: the discount rate at which net present value is zero.'},
        ],
        'limitations': [],
      },
    };

Widget _host(AiChatFn chat) => MaterialApp(home: AiAssistantScreen(chat: chat));

void main() {
  test('cleanAnswerText strips markdown symbols', () {
    expect(cleanAnswerText('### 1. Heading\n**bold** and `code`\n- item'), '1. Heading\nbold and code\n• item');
    expect(cleanAnswerText('a\n\n\n\nb'), 'a\n\nb');
  });

  testWidgets('empty state offers prompts that are sent', (t) async {
    String? asked;
    await t.pumpWidget(_host((m, s) async {
      asked = m;
      return _answer();
    }));
    await t.tap(find.text('What does IRR mean for a solar project?'));
    await t.pumpAndSettle();
    expect(asked, 'What does IRR mean for a solar project?');
    expect(find.byKey(const Key('answerCard')), findsOneWidget);
  });

  testWidgets('answer shows conclusion first, key figures, cited basis, risks and a term explanation', (t) async {
    final gate = Completer<Map<String, dynamic>>();
    await t.pumpWidget(_host((m, s) => gate.future));
    await t.enterText(find.byKey(const Key('aiInput')), 'q');
    await t.tap(find.byKey(const Key('aiSend')));
    await t.pump();
    expect(find.byKey(const Key('aiThinking')), findsOneWidget);
    expect(t.widget<IconButton>(find.byKey(const Key('aiSend'))).onPressed, isNull); // no double send while waiting
    gate.complete(_answer());
    await t.pumpAndSettle();
    expect(find.text('IRR is about 8.5%.'), findsOneWidget);
    expect(find.text('8.5%'), findsOneWidget);
    expect(find.text('[S1] NREL ATB'), findsOneWidget);
    expect(find.byKey(const Key('risksCard')), findsOneWidget);
    // the headline sits above the key figures
    expect(t.getTopLeft(find.byKey(const Key('answerHeadline'))).dy, lessThan(t.getTopLeft(find.byKey(const Key('keyNumber'))).dy));
    await t.tap(find.byKey(const Key('term_IRR')));
    await t.pumpAndSettle();
    expect(find.text('Internal rate of return: the discount rate at which net present value is zero.'), findsOneWidget);
  });

  testWidgets('an answer without sources says so instead of implying support', (t) async {
    await t.pumpWidget(_host((m, s) async => {
          'message': 'x answer',
          'structured': {'headline': 'x', 'key_numbers': [], 'basis': [], 'risks': [], 'glossary': [], 'limitations': []},
        }));
    await t.enterText(find.byKey(const Key('aiInput')), 'q');
    await t.tap(find.byKey(const Key('aiSend')));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('noBasis')), findsOneWidget);
    expect(find.byKey(const Key('basisItem')), findsNothing);
  });

  testWidgets('the style switch changes what is sent', (t) async {
    final styles = <String>[];
    await t.pumpWidget(_host((m, s) async {
      styles.add(s);
      return _answer();
    }));
    await t.enterText(find.byKey(const Key('aiInput')), 'one');
    await t.tap(find.byKey(const Key('aiSend')));
    await t.pumpAndSettle();
    await t.tap(find.text('Plain words'));
    await t.pumpAndSettle();
    await t.enterText(find.byKey(const Key('aiInput')), 'two');
    await t.tap(find.byKey(const Key('aiSend')));
    await t.pumpAndSettle();
    expect(styles, ['pro', 'plain']);
  });

  testWidgets('a failure keeps the question and offers a retry that works', (t) async {
    var calls = 0;
    await t.pumpWidget(_host((m, s) async {
      calls++;
      if (calls == 1) throw ApiException(503, 'down');
      return _answer();
    }));
    await t.enterText(find.byKey(const Key('aiInput')), 'my question');
    await t.tap(find.byKey(const Key('aiSend')));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('aiError')), findsOneWidget);
    expect(find.text('The network or service is unavailable. Your question is kept so you can retry.'), findsOneWidget);
    await t.tap(find.byKey(const Key('aiRetry')));
    await t.pumpAndSettle();
    expect(calls, 2);
    expect(find.byKey(const Key('answerCard')), findsOneWidget);
  });

  testWidgets('quota exhausted points to the plan & usage page rather than retrying', (t) async {
    await t.pumpWidget(_host((m, s) async => throw ApiException(429, 'quota')));
    await t.enterText(find.byKey(const Key('aiInput')), 'q');
    await t.tap(find.byKey(const Key('aiSend')));
    await t.pumpAndSettle();
    expect(find.text('You have used today\'s AI questions. Try again tomorrow, or check your limits under Plan & usage.'), findsOneWidget);
    expect(find.byKey(const Key('aiRetry')), findsNothing);
    expect(find.byKey(const Key('aiOpenPlan')), findsOneWidget);
  });

  testWidgets('a reply without structure still shows clean text', (t) async {
    await t.pumpWidget(_host((m, s) async => {'message': '### 1. Title\n**bold** text'}));
    await t.enterText(find.byKey(const Key('aiInput')), 'q');
    await t.tap(find.byKey(const Key('aiSend')));
    await t.pumpAndSettle();
    expect(find.textContaining('###'), findsNothing);
    expect(find.textContaining('**'), findsNothing);
    expect(find.textContaining('bold text'), findsOneWidget);
  });

  testWidgets('input and send button are labelled for screen readers', (t) async {
    final h = t.ensureSemantics();
    await t.pumpWidget(_host((m, s) async => _answer()));
    expect(find.byTooltip('Send'), findsOneWidget); // the tooltip is what a screen reader announces
    expect(find.bySemanticsLabel('Answer style'), findsWidgets);
    h.dispose();
  });

  testWidgets('screen text follows the edition language', (t) async {
    await t.pumpWidget(_host((m, s) async => _answer()));
    final texts = t.widgetList<Text>(find.byType(Text)).map((w) => w.data ?? '').where((s) => RegExp(r'[A-Za-z\u3400-\u9fff]').hasMatch(s)).toList();
    final expectCjk = _isDomestic();
    if (expectCjk) {
      expect(texts.where((s) => !_cjk.hasMatch(s)), isEmpty);
    } else {
      expect(texts.where(_cjk.hasMatch), isEmpty);
    }
  });
}
