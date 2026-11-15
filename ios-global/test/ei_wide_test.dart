import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_global_ios/widgets/ei_wide.dart';

void main() {
  Future<void> pumpAt(WidgetTester tester, double width, Widget w) async {
    tester.view.physicalSize = Size(width, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: w)));
  }

  testWidgets('desktop: the two blocks sit side by side', (tester) async {
    await pumpAt(tester, 1440, const EiContentFrame(child: EiTwoColumn(left: SizedBox(key: Key('l'), height: 40), right: SizedBox(key: Key('r'), height: 40))));
    final l = tester.getTopLeft(find.byKey(const Key('l')));
    final r = tester.getTopLeft(find.byKey(const Key('r')));
    expect(l.dy, r.dy);
    expect(r.dx, greaterThan(l.dx));
    expect(tester.getSize(find.byType(EiTwoColumn)).width, lessThanOrEqualTo(1200));
  });

  testWidgets('phone: the blocks stack', (tester) async {
    await pumpAt(tester, 390, const EiContentFrame(child: EiTwoColumn(left: SizedBox(key: Key('l'), height: 40), right: SizedBox(key: Key('r'), height: 40))));
    expect(tester.getTopLeft(find.byKey(const Key('r'))).dy, greaterThan(tester.getTopLeft(find.byKey(const Key('l'))).dy));
  });
}
