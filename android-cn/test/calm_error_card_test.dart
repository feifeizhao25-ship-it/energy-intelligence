import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_app/widgets/calm_error_card.dart';

class _Boom extends StatelessWidget {
  const _Boom();

  @override
  Widget build(BuildContext context) {
    throw Exception('render failed');
  }
}

void main() {
  testWidgets('a build failure shows a calm card instead of a red screen', (tester) async {
    final previousOnError = FlutterError.onError;
    final previousBuilder = ErrorWidget.builder;
    installCalmErrorWidget(english: false);
    try {
      await tester.pumpWidget(const MaterialApp(home: _Boom()));
      expect(find.byKey(const Key('calm-error-card')), findsOneWidget);
      expect(find.text('这一处暂时显示不了'), findsOneWidget);
      expect(find.textContaining('返回后重新打开'), findsOneWidget);
      expect(find.textContaining('Exception'), findsNothing);
      expect(tester.takeException(), isNotNull);
    } finally {
      FlutterError.onError = previousOnError;
      ErrorWidget.builder = previousBuilder;
    }
  });
}
