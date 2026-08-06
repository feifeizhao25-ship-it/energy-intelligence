import 'package:energy_app/main.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('国内版登录页保持全中文', (tester) async {
    await tester.pumpWidget(const NewEnergyApp());
    await tester.pumpAndSettle();

    expect(find.text('新能源智库'), findsOneWidget);
    expect(find.text('登录'), findsWidgets);
    expect(find.text('Sign in to your account'), findsNothing);
  });
}
