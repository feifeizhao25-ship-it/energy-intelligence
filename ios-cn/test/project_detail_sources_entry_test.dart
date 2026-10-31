import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_app/models/project.dart';
import 'package:energy_app/screens/projects/project_detail_screen.dart';
import 'package:energy_app/screens/projects/report_sources_screen.dart';

void main() {
  testWidgets('项目详情里能进入“报告数据来源”', (t) async {
    final project = Project(
      id: 'p1', userId: 'u1', name: '张家口光伏', projectType: 'solar_pv', status: 'operating',
      lat: 40.8, lng: 114.9, address: '', province: '河北', capacityMw: 50, tags: const [], createdAt: DateTime(2026, 1, 1),
    );
    await t.pumpWidget(MaterialApp(home: ProjectDetailScreen(project: project)));
    await t.ensureVisible(find.text('报告数据来源'));
    await t.pumpAndSettle();
    await t.tap(find.text('报告数据来源'));
    await t.pump();
    await t.pump(const Duration(milliseconds: 400));
    expect(find.byType(ReportSourcesScreen), findsOneWidget);
  });
}
