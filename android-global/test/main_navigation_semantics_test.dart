import 'dart:ui' show Tristate;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_global/main.dart';

void main() {
  testWidgets('bottom tabs are announced with their names and the selected one is marked', (t) async {
    final handle = t.ensureSemantics();
    await t.pumpWidget(const MaterialApp(home: MainNavigation()));
    await t.pump(const Duration(milliseconds: 300));
    for (final name in ['Dashboard', 'Projects', 'Resources', 'Finance', 'AI']) {
      expect(find.bySemanticsLabel(name), findsWidgets, reason: name);
    }
    final first = t.getSemantics(find.byKey(const Key('navTab0')));
    expect(first.flagsCollection.isSelected, Tristate.isTrue);
    final second = t.getSemantics(find.byKey(const Key('navTab1')));
    expect(second.flagsCollection.isSelected, isNot(Tristate.isTrue));
    expect(first.label, isNotEmpty);
    handle.dispose();
  });
}
