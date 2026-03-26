class User {
  final String id, name, email, company, country, plan, currency, timezone;
  const User({
    required this.id,
    required this.name,
    required this.email,
    required this.company,
    required this.country,
    required this.plan,
    required this.currency,
    required this.timezone,
  });
}

class Project {
  final String id, name, type, status, locationAddress, locationCountry;
  final double capacity, lat, lng;
  final double? budget;
  final String startDate;
  final List<String> tags;
  const Project({
    required this.id,
    required this.name,
    required this.type,
    required this.status,
    required this.locationAddress,
    required this.locationCountry,
    required this.capacity,
    required this.lat,
    required this.lng,
    required this.startDate,
    required this.tags,
    this.budget,
  });
}

class SolarAssessment {
  final double ghi, dni, dhi, score, peakSunHours, optimalTilt, avgTemperature;
  final String resourceClass, dataSource;
  final List<double> monthlyGHI;
  const SolarAssessment({
    required this.ghi,
    required this.dni,
    required this.dhi,
    required this.score,
    required this.peakSunHours,
    required this.optimalTilt,
    required this.avgTemperature,
    required this.resourceClass,
    required this.dataSource,
    required this.monthlyGHI,
  });
}

class WindAssessment {
  final double meanSpeed, weibullK, weibullC, wpd, score, turbulenceIntensity;
  final String resourceClass;
  final List<double> monthlySpeed;
  final List<Map<String, dynamic>> roseDirections;
  const WindAssessment({
    required this.meanSpeed,
    required this.weibullK,
    required this.weibullC,
    required this.wpd,
    required this.score,
    required this.turbulenceIntensity,
    required this.resourceClass,
    required this.monthlySpeed,
    required this.roseDirections,
  });
}

class Alert {
  final String id, title, message, severity;
  final bool isRead;
  const Alert({
    required this.id,
    required this.title,
    required this.message,
    required this.severity,
    required this.isRead,
  });
}
