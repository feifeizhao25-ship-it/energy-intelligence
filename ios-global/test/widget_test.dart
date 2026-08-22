import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_global/main.dart';

void main() {
  testWidgets('global iOS app starts in English', (tester) async {
    await tester.pumpWidget(const EnergyIntelligenceApp());
    await tester.pump();
    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(app.locale, const Locale('en', 'US'));
  });
}
