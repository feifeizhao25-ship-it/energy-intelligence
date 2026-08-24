import 'package:integration_test/integration_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_global/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('global app starts with an English login experience', (tester) async {
    app.main();
    await tester.pumpAndSettle();

    expect(find.text('Energy Intelligence'), findsWidgets);
    expect(find.text('新能源智库'), findsNothing);
  });
}
