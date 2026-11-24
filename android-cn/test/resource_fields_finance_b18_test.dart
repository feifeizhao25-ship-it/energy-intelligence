// 步骤7（2026-11-23，待定39 已放行部分）：资源接口字段映射、光伏财务空白页、风电财务只加标注和测试。
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:energy_app/models/resource_assessment.dart';
import 'package:energy_app/screens/finance/solar_finance_screen.dart';
import 'package:energy_app/screens/finance/wind_finance_screen.dart';
import 'package:energy_app/theme/app_theme.dart';

void main() {
  // 后端 /api/v1/resource/wind 原文（步骤3 批14 能4 接口原文的字段和数值）
  const wind = {
    'lat': 41.0, 'lng': 113.1, 'mean_speed': 5.52, 'weibull_k': 2.0, 'weibull_c': 6.23,
    'wind_power_density': 104.6, 'turbulence_intensity': 0.11, 'resource_class': 'IV', 'score': 20.0,
    'monthly_speed': [5.8, 6.0, 6.1, 6.0, 5.6, 5.0, 4.6, 4.5, 5.0, 5.5, 5.9, 6.2],
  };
  const solar = {
    'lat': 31.2, 'lng': 121.5, 'ghi': 1366.5, 'dni': 751.8, 'dhi': 614.9, 'peak_sun_hours': 3.74,
    'optimal_tilt': 26.8, 'avg_temperature': 16.2, 'resource_class': 'III', 'score': 42.0,
    'data_source': '离线样本', 'monthly_ghi': [69.8, 76.0, 118.6, 136.0, 149.4, 127.2, 159.2, 154.8, 122.5, 107.3, 76.7, 69.2],
  };

  test('风资源：认后端 snake_case，IV 类不再显示成 A 级', () {
    final r = ResourceAssessment.fromJson(Map<String, dynamic>.from(wind));
    expect(r.assessmentType, 'wind');
    expect(r.windSpeedAnnual, 5.52);
    expect(r.windPowerDensity, 104.6);
    expect(r.weibullK, 2.0);
    expect(r.turbulenceIntensity, 0.11);
    expect(r.siteScore, 20.0);
    expect(r.siteGrade, 'IV');
    expect(r.windSpeedMonthly, hasLength(12));
    expect(r.gradeColor, '#EF4444');
  });

  test('光伏资源：没有逐月气温时用年均值，不再 reduce 空数组', () {
    final r = ResourceAssessment.fromJson(Map<String, dynamic>.from(solar));
    expect(r.ghiAnnual, 1366.5);
    expect(r.dniAnnual, 751.8);
    expect(r.siteGrade, 'III');
    expect(r.ghiMonthly, hasLength(12));
    expect(r.temperatureMonthly, isEmpty);
    expect(r.annualTemperature, 16.2);
    expect(r.recommendation, contains('离线样本'));
  });

  test('缺级别时显示「—」，不默认 A；旧 camelCase 仍然认', () {
    expect(ResourceAssessment.fromJson({}).siteGrade, '—');
    expect(ResourceAssessment.fromJson({}).annualTemperature, isNull);
    final old = ResourceAssessment.fromJson({'siteGrade': 'B', 'ghiAnnual': 1500, 'temperatureMonthly': [10, 20]});
    expect(old.siteGrade, 'B');
    expect(old.ghiAnnual, 1500.0);
    expect(old.annualTemperature, 15.0);
  });

  testWidgets('光伏财务计算页能画出来（原来步骤条里的 Expanded 触发布局断言，整页空白）', (t) async {
    await t.pumpWidget(MaterialApp(theme: AppTheme.buildTheme(), home: const SolarFinanceScreen()));
    await t.pump();
    expect(t.takeException(), isNull);
    expect(find.text('光伏财务计算'), findsOneWidget);
    expect(find.text('项目基础信息'), findsOneWidget);
  });

  testWidgets('风电财务页显示「本地粗算、未核对」标注（公式不改，待定39）', (t) async {
    await t.pumpWidget(MaterialApp(theme: AppTheme.buildTheme(), home: const WindFinanceScreen()));
    await t.pump();
    expect(t.takeException(), isNull);
    expect(find.byKey(const Key('wind-finance-unverified-note')), findsOneWidget);
    expect(find.textContaining('不能作为决策依据'), findsOneWidget);
  });

  // 风电财务公式的正确期望先写在这里，公式口径由主人/专家确认后再去掉 skip（待定39）：
  // 50 MW × 0.28 × 8760 h = 122640 MWh；0.38 元/kWh → 年收入 122640 × 1000 × 0.38 = 4660.32 万元（不是 ×10000）。
  test('TODO(待定39) 风电财务年收入按 MWh×1000×元/kWh 计', () {
    const annualGenMwh = 50 * 0.28 * 8760;
    expect(annualGenMwh * 1000 * 0.38 / 1e4, closeTo(4660.32, 0.01));
  }, skip: '公式改动待主人/专家确认（待定39），本 PR 只加标注');
}
