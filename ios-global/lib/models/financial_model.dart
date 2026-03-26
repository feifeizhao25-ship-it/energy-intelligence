class FinancialModel {
  final String id;
  final String modelType;
  final String modelName;
  final double capacityMwp;
  final double capexTotal;
  final double opexAnnual;
  final double electricityPrice;
  final double irrEquity;
  final double npv;
  final double lcoe;
  final double paybackStatic;
  final List<double> annualCashflow;

  FinancialModel({
    required this.id,
    required this.modelType,
    required this.modelName,
    required this.capacityMwp,
    required this.capexTotal,
    required this.opexAnnual,
    required this.electricityPrice,
    required this.irrEquity,
    required this.npv,
    required this.lcoe,
    required this.paybackStatic,
    required this.annualCashflow,
  });

  factory FinancialModel.fromJson(Map<String, dynamic> json) {
    return FinancialModel(
      id: json['id'] ?? '',
      modelType: json['modelType'] ?? 'solar',
      modelName: json['modelName'] ?? '',
      capacityMwp: (json['capacityMwp'] ?? 0.0).toDouble(),
      capexTotal: (json['capexTotal'] ?? 0.0).toDouble(),
      opexAnnual: (json['opexAnnual'] ?? 0.0).toDouble(),
      electricityPrice: (json['electricityPrice'] ?? 0.0).toDouble(),
      irrEquity: (json['irrEquity'] ?? 0.0).toDouble(),
      npv: (json['npv'] ?? 0.0).toDouble(),
      lcoe: (json['lcoe'] ?? 0.0).toDouble(),
      paybackStatic: (json['paybackStatic'] ?? 0.0).toDouble(),
      annualCashflow: List<double>.from(
        (json['annualCashflow'] ?? []).map((v) => (v as num).toDouble()),
      ),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'modelType': modelType,
      'modelName': modelName,
      'capacityMwp': capacityMwp,
      'capexTotal': capexTotal,
      'opexAnnual': opexAnnual,
      'electricityPrice': electricityPrice,
      'irrEquity': irrEquity,
      'npv': npv,
      'lcoe': lcoe,
      'paybackStatic': paybackStatic,
      'annualCashflow': annualCashflow,
    };
  }
}
