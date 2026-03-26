import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../widgets/bar_chart.dart';

class WindFinanceScreen extends StatefulWidget {
  const WindFinanceScreen({super.key});

  @override
  State<WindFinanceScreen> createState() => _WindFinanceScreenState();
}

class _WindFinanceScreenState extends State<WindFinanceScreen> {
  int _currentStep = 0;
  final _capacityController = TextEditingController(text: '50');
  final _capacityFactorController = TextEditingController(text: '0.28');
  final _capexController = TextEditingController(text: '72000');
  final _opexController = TextEditingController(text: '450');
  final _electricityController = TextEditingController(text: '0.38');
  bool _isCalculating = false;

  Map<String, dynamic>? _result;

  @override
  void dispose() {
    _capacityController.dispose();
    _capacityFactorController.dispose();
    _capexController.dispose();
    _opexController.dispose();
    _electricityController.dispose();
    super.dispose();
  }

  void _calculate() async {
    setState(() => _isCalculating = true);
    await Future.delayed(Duration(milliseconds: 800));

    final capacityMw = double.tryParse(_capacityController.text) ?? 50;
    final cf = double.tryParse(_capacityFactorController.text) ?? 0.28;
    final capex = double.tryParse(_capexController.text) ?? 72000;
    final opex = double.tryParse(_opexController.text) ?? 450;
    final price = double.tryParse(_electricityController.text) ?? 0.38;

    final annualGenMwh = capacityMw * cf * 8760;
    final annualRevenue = annualGenMwh * price * 10000;
    final totalCapex = capex * capacityMw * 10000;
    final annualOpex = opex * capacityMw * 10000;

    // Newton-Raphson IRR (25-year lifecycle)
    final cashflows = <double>[-totalCapex];
    for (int y = 1; y <= 25; y++) {
      final degradationFactor = 1.0 - 0.005 * (y - 1);
      cashflows.add((annualRevenue * degradationFactor) - annualOpex);
    }

    double irr = 0.08;
    for (int i = 0; i < 1000; i++) {
      double npv = 0, dnpv = 0;
      for (int t = 0; t < cashflows.length; t++) {
        final disc = _pow(1 + irr, t);
        npv += cashflows[t] / disc;
        dnpv -= t * cashflows[t] / (disc * (1 + irr));
      }
      if (dnpv.abs() < 1e-10) break;
      final newIrr = irr - npv / dnpv;
      if ((newIrr - irr).abs() < 1e-7) { irr = newIrr; break; }
      irr = newIrr;
    }

    final npv8 = cashflows.fold<double>(
      0,
      (sum, cf) {
        final t = cashflows.indexOf(cf);
        return sum + cf / _pow(1.08, t);
      },
    );

    final lcoe = (totalCapex + annualOpex * 25) / (annualGenMwh * 25);

    setState(() {
      _result = {
        'irr': irr * 100,
        'npv': npv8 / 1e4,
        'lcoe': lcoe,
        'annualGen': annualGenMwh,
        'payback': totalCapex / (annualRevenue - annualOpex),
        'cashflows': cashflows.sublist(1, 11).map((c) => c / 1e4).toList(),
      };
      _currentStep = 3;
      _isCalculating = false;
    });
  }

  double _pow(double base, int exp) {
    double result = 1;
    for (int i = 0; i < exp; i++) result *= base;
    return result;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('风电财务分析'),
        backgroundColor: const Color(0xFF1D4ED8),
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Step indicators
            Row(
              children: ['基本参数', '电价设置', '分析结果'].asMap().entries.map((e) {
                final active = _currentStep >= e.key;
                return Expanded(
                  child: Container(
                    margin: EdgeInsets.symmetric(horizontal: 2),
                    height: 4,
                    decoration: BoxDecoration(
                      color: active ? Color(0xFF1D4ED8) : Color(0xFFE2E8F0),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                );
              }).toList(),
            ),
            SizedBox(height: 24),

            // Input parameters
            Text('装机容量 (MW)', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
            SizedBox(height: 8),
            TextField(
              controller: _capacityController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                contentPadding: EdgeInsets.all(12),
                suffixText: 'MW',
              ),
            ),
            SizedBox(height: 16),
            Text('年利用小时数 (容量系数)', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
            SizedBox(height: 8),
            TextField(
              controller: _capacityFactorController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                contentPadding: EdgeInsets.all(12),
                hintText: '如: 0.28 表示 28%',
              ),
            ),
            SizedBox(height: 16),
            Text('单位投资成本 (万元/MW)', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
            SizedBox(height: 8),
            TextField(
              controller: _capexController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                contentPadding: EdgeInsets.all(12),
                suffixText: '万元/MW',
              ),
            ),
            SizedBox(height: 16),
            Text('年度运维成本 (万元/MW)', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
            SizedBox(height: 8),
            TextField(
              controller: _opexController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                contentPadding: EdgeInsets.all(12),
                suffixText: '万元/MW',
              ),
            ),
            SizedBox(height: 16),
            Text('上网电价 (元/kWh)', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
            SizedBox(height: 8),
            TextField(
              controller: _electricityController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                contentPadding: EdgeInsets.all(12),
                suffixText: '元/kWh',
              ),
            ),
            SizedBox(height: 24),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isCalculating ? null : () { setState(() => _currentStep = 1); _calculate(); },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Color(0xFF1D4ED8),
                  foregroundColor: Colors.white,
                  padding: EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: _isCalculating
                    ? Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                        SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)),
                        SizedBox(width: 12),
                        Text('计算中...'),
                      ])
                    : Text('开始计算', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ),
            ),

            // Results
            if (_result != null) ...[
              SizedBox(height: 32),
              Text('财务分析结果', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
              SizedBox(height: 16),
              _buildResultGrid(),
              SizedBox(height: 24),
              Text('未来10年现金流 (万元)', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
              SizedBox(height: 12),
              SizedBox(
                height: 200,
                child: BarChart(
                  values: (_result!['cashflows'] as List<dynamic>).map((e) => (e as double).toDouble()).toList(),
                  labels: List.generate(10, (i) => 'Y${i + 1}'),
                  barColor: Color(0xFF06B6D4),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildResultGrid() {
    final items = [
      {'label': 'IRR (内部收益率)', 'value': '${_result!['irr'].toStringAsFixed(2)}%', 'color': Color(0xFF059669)},
      {'label': 'NPV (净现值 @8%)', 'value': '${(_result!['npv'] as double).toStringAsFixed(0)} 万元', 'color': Color(0xFF1D4ED8)},
      {'label': 'LCOE (度电成本)', 'value': '${((_result!['lcoe'] as double) * 1000).toStringAsFixed(2)} 元/kWh', 'color': Color(0xFF7C3AED)},
      {'label': '回收期', 'value': '${(_result!['payback'] as double).toStringAsFixed(1)} 年', 'color': Color(0xFFEA580C)},
      {'label': '年发电量', 'value': '${((_result!['annualGen'] as double) / 10000).toStringAsFixed(1)} 亿kWh', 'color': Color(0xFF0891B2)},
    ];

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.8,
      children: items.map((item) => Container(
        padding: EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: (item['color'] as Color).withOpacity(0.08),
          border: Border.all(color: (item['color'] as Color).withOpacity(0.3)),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(item['label'] as String, style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
            SizedBox(height: 6),
            Text(item['value'] as String, style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: item['color'] as Color)),
          ],
        ),
      )).toList(),
    );
  }
}
