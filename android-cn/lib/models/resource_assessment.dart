class ResourceAssessment {
  final String id;
  final String assessmentType;
  final double lat;
  final double lng;
  final double ghiAnnual;
  final double dniAnnual;
  final double windSpeedAnnual;
  final double windPowerDensity;
  final double weibullK;
  final double turbulenceIntensity;
  final double siteScore;
  final String siteGrade;
  final String recommendation;
  final List<double> ghiMonthly;
  final List<double> temperatureMonthly;
  final List<double> windSpeedMonthly;
  /// 后端只给年均气温（avg_temperature）时用它；没有就为 null，界面显示「—」，不编数。
  final double? avgTemperature;
  /// 国内版风资源：GB/T 18710 表 4 等级说明（后端有就显示）。
  final String? gradeLabel;
  final String dataSource;

  ResourceAssessment({
    required this.id,
    required this.assessmentType,
    required this.lat,
    required this.lng,
    required this.ghiAnnual,
    required this.dniAnnual,
    required this.windSpeedAnnual,
    required this.windPowerDensity,
    required this.weibullK,
    required this.turbulenceIntensity,
    required this.siteScore,
    required this.siteGrade,
    required this.recommendation,
    required this.ghiMonthly,
    required this.temperatureMonthly,
    required this.windSpeedMonthly,
    this.avgTemperature,
    this.gradeLabel,
    this.dataSource = '',
  });

  /// 同时认 App 自己的 camelCase 和后端 /api/v1/resource/solar|wind 返回的 snake_case（ghi、mean_speed、
  /// wind_power_density、resource_class、score、monthly_ghi、monthly_speed、avg_temperature）。
  /// 以前只认 camelCase，后端字段全取不到，级别落到默认值 A，把 IV 类差资源显示成了 A 级（步骤3 批14 第 1、4 条）。
  /// 缺级别时显示「—」，不再默认 A。
  factory ResourceAssessment.fromJson(Map<String, dynamic> json) {
    double num_(List<String> keys) {
      for (final k in keys) {
        final v = json[k];
        if (v is num) return v.toDouble();
      }
      return 0.0;
    }

    List<double> list_(List<String> keys) {
      for (final k in keys) {
        final v = json[k];
        if (v is List && v.isNotEmpty) {
          return v.whereType<num>().map((e) => e.toDouble()).toList();
        }
      }
      return <double>[];
    }

    final grade = json['siteGrade'] ?? json['resource_class'];
    final isWind = json['assessmentType'] == 'wind' || json.containsKey('mean_speed');
    final avgT = json['avgTemperature'] ?? json['avg_temperature'];
    final source = (json['data_source'] ?? json['dataSource'] ?? '').toString();
    final label = json['gb_grade_label'] ?? json['gradeLabel'];
    return ResourceAssessment(
      id: json['id'] ?? '',
      assessmentType: json['assessmentType'] ?? (isWind ? 'wind' : 'solar'),
      lat: num_(['lat']),
      lng: num_(['lng']),
      ghiAnnual: num_(['ghiAnnual', 'ghi']),
      dniAnnual: num_(['dniAnnual', 'dni']),
      windSpeedAnnual: num_(['windSpeedAnnual', 'mean_speed']),
      windPowerDensity: num_(['windPowerDensity', 'wind_power_density']),
      weibullK: num_(['weibullK', 'weibull_k']),
      turbulenceIntensity: num_(['turbulenceIntensity', 'turbulence_intensity']),
      siteScore: num_(['siteScore', 'score']),
      siteGrade: (grade == null || '$grade'.isEmpty) ? '—' : '$grade',
      recommendation: (json['recommendation'] ??
              [
                if (label != null) '风功率密度 $label',
                if (source.isNotEmpty) '数据来源：$source',
              ].join('；'))
          .toString(),
      ghiMonthly: list_(['ghiMonthly', 'monthly_ghi']),
      temperatureMonthly: list_(['temperatureMonthly', 'monthly_temperature', 'monthly_temp']),
      windSpeedMonthly: list_(['windSpeedMonthly', 'monthly_speed']),
      avgTemperature: avgT is num ? avgT.toDouble() : null,
      gradeLabel: label == null ? null : '$label',
      dataSource: source,
    );
  }

  /// 年均气温：有逐月就取平均，否则用后端年均值；都没有返回 null。
  double? get annualTemperature {
    if (temperatureMonthly.isNotEmpty) {
      return temperatureMonthly.reduce((a, b) => a + b) / temperatureMonthly.length;
    }
    return avgTemperature;
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'assessmentType': assessmentType,
      'lat': lat,
      'lng': lng,
      'ghiAnnual': ghiAnnual,
      'dniAnnual': dniAnnual,
      'windSpeedAnnual': windSpeedAnnual,
      'windPowerDensity': windPowerDensity,
      'weibullK': weibullK,
      'turbulenceIntensity': turbulenceIntensity,
      'siteScore': siteScore,
      'siteGrade': siteGrade,
      'recommendation': recommendation,
      'ghiMonthly': ghiMonthly,
      'temperatureMonthly': temperatureMonthly,
      'windSpeedMonthly': windSpeedMonthly,
    };
  }

  String get gradeColor {
    switch (siteGrade) {
      case 'A':
      case 'I':
        return '#10B981';
      case 'B':
      case 'II':
        return '#3B82F6';
      case 'C':
      case 'III':
        return '#F59E0B';
      case 'D':
      case 'IV':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  }
}
