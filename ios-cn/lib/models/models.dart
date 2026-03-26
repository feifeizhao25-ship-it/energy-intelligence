// 数据模型

class Metric {
  final String label;
  final String value;
  final double change;
  final String trend;
  
  Metric({required this.label, required this.value, required this.change, required this.trend});
}

class Project {
  final String id;
  final String name;
  final String type;
  final String status;
  final double capacity;
  final double? irr;
  final int healthScore;
  
  Project({required this.id, required this.name, required this.type, required this.status, required this.capacity, this.irr, required this.healthScore});
  
  String get typeIcon => type == 'pv' ? '☀️' : (type == 'wind' ? '🌀' : '🔋');
}

class Alert {
  final String id;
  final String type;
  final String message;
  final String time;
  
  Alert({required this.id, required this.type, required this.message, required this.time});
}

class HealthData {
  final String projectName;
  final int score;
  final String status;
  final List<Issue> issues;
  
  HealthData({required this.projectName, required this.score, required this.status, required this.issues});
}

class Issue {
  final String severity;
  final String component;
  final String issue;
  
  Issue({required this.severity, required this.component, required this.issue});
}

class Paper {
  final String title;
  final List<String> authors;
  final String abstract;
  final int year;
  final List<String> tags;
  
  Paper({required this.title, required this.authors, required this.abstract, required this.year, required this.tags});
}

class CalculationResult {
  final double irr;
  final double npv;
  final double payback;
  final double lcoe;
  final double annualRevenue;
  
  CalculationResult({required this.irr, required this.npv, required this.payback, required this.lcoe, required this.annualRevenue});
}
