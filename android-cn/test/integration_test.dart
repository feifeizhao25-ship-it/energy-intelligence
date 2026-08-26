import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_app/main.dart';

void main() {
  testWidgets('国内版使用中文区域并显示登录页', (tester) async {
    await tester.pumpWidget(const NewEnergyApp());
    await tester.pump();
    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(app.locale, const Locale('zh', 'CN'));
    expect(find.text('登录'), findsWidgets);
  });
}
