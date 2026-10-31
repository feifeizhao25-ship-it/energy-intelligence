import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_app/models/project.dart';
import 'package:energy_app/widgets/project_card.dart';

Project _p({String address = '', String province = '', double mw = 20}) => Project(
      id: 'p1', userId: 'u', name: '酒泉光伏一期', projectType: 'solar_pv', status: 'draft', lat: 39.7, lng: 98.5,
      address: address, province: province, capacityMw: mw, tags: const [], createdAt: DateTime(2026, 10, 31));

void main() {
  Future<void> show(WidgetTester t, Project p) => t.pumpWidget(MaterialApp(home: Scaffold(body: ProjectCard(project: p))));

  testWidgets('a project saved from the app shows the place the user typed', (t) async {
    await show(t, _p(address: '甘肃省酒泉市'));
    expect(find.text('甘肃省酒泉市 · 20MW'), findsOneWidget);
  });

  testWidgets('province wins when the server sends one', (t) async {
    await show(t, _p(address: '酒泉市肃州区', province: '甘肃'));
    expect(find.text('甘肃 · 20MW'), findsOneWidget);
  });

  testWidgets('no place at all: capacity only, no dangling separator', (t) async {
    await show(t, _p());
    expect(find.text('20MW'), findsOneWidget);
    expect(find.textContaining(' · '), findsNothing);
  });
}
