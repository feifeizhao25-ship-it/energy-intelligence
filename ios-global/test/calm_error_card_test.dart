import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_global_ios/widgets/calm_error_card.dart';

class _Boom extends StatelessWidget {
  const _Boom();

  @override
  Widget build(BuildContext context) {
    throw Exception('render failed');
  }
}

void main() {
  testWidgets('a build failure shows a calm card instead of a red screen', (tester) async {
    installCalmErrorWidget(english: true);
    await tester.pumpWidget(const MaterialApp(home: _Boom()));
    expect(find.byKey(const Key('calm-error-card')), findsOneWidget);
    expect(find.text('This section could not be shown'), findsOneWidget);
    expect(find.textContaining('Go back and open it again'), findsOneWidget);
    expect(find.textContaining('Exception'), findsNothing);
    expect(tester.takeException(), isNotNull);
  });
}
