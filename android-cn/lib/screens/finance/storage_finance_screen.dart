import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../widgets/bar_chart.dart';

class StorageFinanceScreen extends StatefulWidget {
  const StorageFinanceScreen({super.key});

  @override
  State<StorageFinanceScreen> createState() => _StorageFinanceScreenState();
}

class _StorageFinanceScreenState extends State<StorageFinanceScreen> {
  final _powerController = TextEditingController(text: '100');
  final _capacityController = TextEditingController(text: '200');
  final _cyclesController = TextEditingController(text: '300');
  final _peakPriceController = TextEditingController(text: '0.85');
  final _valleyPriceController = TextEditingController(text: '0.28');
  final _capexController = TextEditingController(text: '150');
  bool _isCalculating = false;
  Map<String, dynamic>? _result;

  @override
  void dispose() {
    _powerController.dispose();
    _capacityController.dispose();
    _cyclesController.dispose();
    _peakPriceController.dispose();
    _valleyPriceController.dispose();
    _capexController.dispose();
    super.dispose();
  }

  void _calculate() async {
    setState(() => _isCalculating = true);
    await Future.delayed(Duration(milliseconds: 600));

    final powerMw = double.tryParse(_powerController.text) ?? 100;
    final capacityMwh = double.tryParse(_capacityController.text) ?? 200;
    final cycles = double.tryParse(_cyclesController.text) ?? 300;
    final peakPrice = double.tryParse(_peakPriceController.text) ?? 0.85;
    final valleyPrice = double.tryParse(_valleyPriceController.text) ?? 0.28;
    final capexPerKwh = double.tryParse(_capexController.text) ?? 150;

    final spread = peakPrice - valleyPrice; // 峰谷差价
    final roundtripEff = 0.88;
    final annualRevenue = capacityMwh * cycles * spread * roundtripEff * 10000;
    final totalCapex = capacityMwh * capexPerKwh * 10000 * 10; // 元
    final annualOpex = totalCapex * 0.02;

    // 10-year cashflows with capacity degradation
    final cashflows = <double>[-totalCapex];
    for (int y = 1; y <= 10; y++) {
      final degradation = 1.0 - 0.025 * (y - 1); // 2.5%/yr
      cashflows.add(annualRevenue * degradation - annualOpex);
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

    final annualArbitrage = capacityMwh * cycles * spread * roundtripEff;
    final payback = totalCapex / (annualRevenue - annualOpex);

    setState(() {
      _result = {
        'irr': irr * 100,
        'annualRevenue': annualRevenue / 10000,
        'annualArbitrage': annualArbitrage,
        'payback': payback,
        'totalCapex': totalCapex / 10000,
        'cashflows': cashflows.sublist(1).map((c) => c / 10000).toList(),
      };
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
        title: Text('储能财务分析'),
        backgroundColor: const Color(0xFF1D4ED8),
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Key parameters
            _buildSectionTitle('储能系统参数'),
            SizedBox(height: 16),
            _buildTextField('额定功率 (MW)', _powerController, 'MW'),
            SizedBox(height: 12),
            _buildTextField('额定容量 (MWh)', _capacityController, 'MWh'),
            SizedBox(height: 12),
            _buildTextField('年充放电次数', _cyclesController, '次/年'),
            SizedBox(height: 24),
            _buildSectionTitle('峰谷电价'),
            SizedBox(height: 16),
            _buildTextField('峰时电价 (元/kWh)', _peakPriceController, '元/kWh'),
            SizedBox(height: 12),
            _buildTextField('谷时电价 (元/kWh)', _valleyPriceController, '元/kWh'),
            SizedBox(height: 24),
            _buildSectionTitle('投资参数'),
            SizedBox(height: 16),
            _buildTextField('单位投资成本 (万元/MWh)', _capexController, '万元/MWh'),
            SizedBox(height: 24),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isCalculating ? null : _calculate,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Color(0xFF8B5CF6),
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
                    : Text('计算储能收益', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ),
            ),

            if (_result != null) ...[
              SizedBox(height: 32),
              _buildSectionTitle('储能收益分析结果'),
              SizedBox(height: 16),
              _buildResultCards(),
              SizedBox(height: 24),
              Text('10年现金流 (万元)', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
              SizedBox(height: 12),
              SizedBox(
                height: 200,
                child: BarChart(
                  values: (_result!['cashflows'] as List<dynamic>).map((e) => (e as double)).toList(),
                  labels: List.generate(10, (i) => 'Y${i + 1}'),
                  barColor: Color(0xFF8B5CF6),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
    );
  }

  Widget _buildTextField(String label, TextEditingController controller, String suffix) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
        SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            suffixText: suffix,
          ),
        ),
      ],
    );
  }

  Widget _buildResultCards() {
    final items = [
      {'label': '项目IRR', 'value': '${(_result!['irr'] as double).toStringAsFixed(2)}%', 'color': Color(0xFF059669)},
      {'label': '年套利收益', 'value': '${(_result!['annualRevenue'] as double).toStringAsFixed(0)} 万元', 'color': Color(0xFF8B5CF6)},
      {'label': '峰谷套利量', 'value': '${(_result!['annualArbitrage'] as double).toStringAsFixed(0)} MWh/年', 'color': Color(0xFF0891B2)},
      {'label': '投资回收期', 'value': '${(_result!['payback'] as double).toStringAsFixed(1)} 年', 'color': Color(0xFFEA580C)},
      {'label': '总投资额', 'value': '${(_result!['totalCapex'] as double).toStringAsFixed(0)} 万元', 'color': Color(0xFF64748B)},
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
            Text(item['value'] as String, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: item['color'] as Color)),
          ],
        ),
      )).toList(),
    );
  }
}
