import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_app/main.dart';

void main() {
  testWidgets('国内版 iOS 应用可启动', (tester) async {
    await tester.pumpWidget(const NewEnergyApp());
    await tester.pump();
    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(app.locale, const Locale('zh', 'CN'));
    expect(find.text('登录'), findsWidgets);
  });
}
