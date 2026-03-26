import 'package:flutter/material.dart';

class DiagnosticFinding {
  final String id;
  final String severity;
  final String category;
  final String description;
  final String impact;
  final DateTime foundAt;

  DiagnosticFinding({
    required this.id,
    required this.severity,
    required this.category,
    required this.description,
    required this.impact,
    required this.foundAt,
  });

  factory DiagnosticFinding.fromJson(Map<String, dynamic> json) {
    return DiagnosticFinding(
      id: json['id'] ?? '',
      severity: json['severity'] ?? 'info',
      category: json['category'] ?? '',
      description: json['description'] ?? '',
      impact: json['impact'] ?? '',
      foundAt: DateTime.parse(json['foundAt'] ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'severity': severity,
      'category': category,
      'description': description,
      'impact': impact,
      'foundAt': foundAt.toIso8601String(),
    };
  }
}

class DiagnosticRecommendation {
  final String id;
  final String priority;
  final String title;
  final String action;
  final String expectedBenefit;
  final double estimatedCost;

  DiagnosticRecommendation({
    required this.id,
    required this.priority,
    required this.title,
    required this.action,
    required this.expectedBenefit,
    required this.estimatedCost,
  });

  factory DiagnosticRecommendation.fromJson(Map<String, dynamic> json) {
    return DiagnosticRecommendation(
      id: json['id'] ?? '',
      priority: json['priority'] ?? 'medium',
      title: json['title'] ?? '',
      action: json['action'] ?? '',
      expectedBenefit: json['expectedBenefit'] ?? '',
      estimatedCost: (json['estimatedCost'] ?? 0.0).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'priority': priority,
      'title': title,
      'action': action,
      'expectedBenefit': expectedBenefit,
      'estimatedCost': estimatedCost,
    };
  }
}

class DiagnosticReport {
  final String id;
  final String diagnosisType;
  final double healthScore;
  final List<DiagnosticFinding> findings;
  final Map<String, dynamic> economicImpact;
  final List<DiagnosticRecommendation> recommendations;

  DiagnosticReport({
    required this.id,
    required this.diagnosisType,
    required this.healthScore,
    required this.findings,
    required this.economicImpact,
    required this.recommendations,
  });

  factory DiagnosticReport.fromJson(Map<String, dynamic> json) {
    return DiagnosticReport(
      id: json['id'] ?? '',
      diagnosisType: json['diagnosisType'] ?? 'health',
      healthScore: (json['healthScore'] ?? 0.0).toDouble(),
      findings: (json['findings'] ?? [])
          .map<DiagnosticFinding>((f) => DiagnosticFinding.fromJson(f))
          .toList(),
      economicImpact: json['economicImpact'] ?? {},
      recommendations: (json['recommendations'] ?? [])
          .map<DiagnosticRecommendation>((r) => DiagnosticRecommendation.fromJson(r))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'diagnosisType': diagnosisType,
      'healthScore': healthScore,
      'findings': findings.map((f) => f.toJson()).toList(),
      'economicImpact': economicImpact,
      'recommendations': recommendations.map((r) => r.toJson()).toList(),
    };
  }

  String get healthGrade {
    if (healthScore >= 90) return 'A';
    if (healthScore >= 80) return 'B';
    if (healthScore >= 70) return 'C';
    if (healthScore >= 60) return 'D';
    return 'F';
  }

  Color get healthColor {
    if (healthScore >= 90) return Color(0xFF10B981);
    if (healthScore >= 80) return Color(0xFF3B82F6);
    if (healthScore >= 70) return Color(0xFFF59E0B);
    if (healthScore >= 60) return Color(0xFFEF4444);
    return Color(0xFF9CA3AF);
  }
}