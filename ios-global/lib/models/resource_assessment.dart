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
  });

  factory ResourceAssessment.fromJson(Map<String, dynamic> json) {
    return ResourceAssessment(
      id: json['id'] ?? '',
      assessmentType: json['assessmentType'] ?? 'solar',
      lat: (json['lat'] ?? 0.0).toDouble(),
      lng: (json['lng'] ?? 0.0).toDouble(),
      ghiAnnual: (json['ghiAnnual'] ?? 0.0).toDouble(),
      dniAnnual: (json['dniAnnual'] ?? 0.0).toDouble(),
      windSpeedAnnual: (json['windSpeedAnnual'] ?? 0.0).toDouble(),
      windPowerDensity: (json['windPowerDensity'] ?? 0.0).toDouble(),
      weibullK: (json['weibullK'] ?? 0.0).toDouble(),
      turbulenceIntensity: (json['turbulenceIntensity'] ?? 0.0).toDouble(),
      siteScore: (json['siteScore'] ?? 0.0).toDouble(),
      siteGrade: json['siteGrade'] ?? 'A',
      recommendation: json['recommendation'] ?? '',
      ghiMonthly: List<double>.from(
        (json['ghiMonthly'] ?? []).map((v) => (v as num).toDouble()),
      ),
      temperatureMonthly: List<double>.from(
        (json['temperatureMonthly'] ?? []).map((v) => (v as num).toDouble()),
      ),
      windSpeedMonthly: List<double>.from(
        (json['windSpeedMonthly'] ?? []).map((v) => (v as num).toDouble()),
      ),
    );
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
        return '#10B981';
      case 'B':
        return '#3B82F6';
      case 'C':
        return '#F59E0B';
      case 'D':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  }
}
