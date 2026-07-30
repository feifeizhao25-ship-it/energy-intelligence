import 'package:energy_global/main.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('global iOS shell uses the shared English experience', (
    tester,
  ) async {
    await tester.pumpWidget(const EnergyIntelligenceApp());
    await tester.pumpAndSettle();

    expect(find.text('Energy Intelligence'), findsOneWidget);
    expect(find.text('Sign in to your account'), findsOneWidget);
    expect(find.text('新能源智库'), findsNothing);
    expect(find.text('登录'), findsNothing);
  });
}
