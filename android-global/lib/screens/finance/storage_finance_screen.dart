import 'package:flutter/material.dart';
import 'dart:math';
import '../../widgets/bar_chart.dart';

class StorageFinanceScreen extends StatefulWidget {
  const StorageFinanceScreen({super.key});

  @override
  State<StorageFinanceScreen> createState() => _StorageFinanceScreenState();
}

class _StorageFinanceScreenState extends State<StorageFinanceScreen> {
  final _powerCtrl = TextEditingController(text: '100');
  final _capacityCtrl = TextEditingController(text: '400');
  final _cyclesCtrl = TextEditingController(text: '250');
  final _peakCtrl = TextEditingController(text: '120');
  final _valleyCtrl = TextEditingController(text: '30');
  final _capexCtrl = TextEditingController(text: '280');
  bool _isCalc = false;
  Map<String, dynamic>? _result;

  @override
  void dispose() {
    _powerCtrl.dispose();
    _capacityCtrl.dispose();
    _cyclesCtrl.dispose();
    _peakCtrl.dispose();
    _valleyCtrl.dispose();
    _capexCtrl.dispose();
    super.dispose();
  }

  void _calculate() async {
    setState(() => _isCalc = true);
    await Future.delayed(const Duration(milliseconds: 600));

    final powerMw = double.tryParse(_powerCtrl.text) ?? 100;
    final capacityMwh = double.tryParse(_capacityCtrl.text) ?? 400;
    final cycles = double.tryParse(_cyclesCtrl.text) ?? 250;
    final peakPrice = double.tryParse(_peakCtrl.text) ?? 120; // $/MWh
    final valleyPrice = double.tryParse(_valleyCtrl.text) ?? 30;
    final capexPerKwh = double.tryParse(_capexCtrl.text) ?? 280; // $/kWh

    final spread = peakPrice - valleyPrice;
    const roundtripEff = 0.88;
    final annualRevenue = capacityMwh * cycles * spread * roundtripEff;
    final totalCapex = capacityMwh * 1000 * capexPerKwh;
    final annualOpex = totalCapex * 0.02;

    final cashflows = <double>[-totalCapex];
    for (int y = 1; y <= 10; y++) {
      final degradation = 1.0 - 0.025 * (y - 1);
      cashflows.add(annualRevenue * degradation - annualOpex);
    }

    double irr = 0.08;
    for (int i = 0; i < 1000; i++) {
      double npv = 0, dnpv = 0;
      for (int t = 0; t < cashflows.length; t++) {
        final disc = pow(1 + irr, t).toDouble();
        npv += cashflows[t] / disc;
        dnpv -= t * cashflows[t] / (disc * (1 + irr));
      }
      if (dnpv.abs() < 1e-10) break;
      final newIrr = irr - npv / dnpv;
      if ((newIrr - irr).abs() < 1e-7) { irr = newIrr; break; }
      irr = newIrr;
    }

    final payback = totalCapex / (annualRevenue - annualOpex);

    setState(() {
      _result = {
        'irr': irr * 100,
        'annualRevenue': annualRevenue / 1e6,
        'arbitrageMwh': capacityMwh * cycles * roundtripEff,
        'payback': payback,
        'totalCapex': totalCapex / 1e6,
        'cashflows': cashflows.sublist(1).map((c) => c / 1e6).toList(),
      };
      _isCalc = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Storage Finance'),
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E293B),
      ),
      backgroundColor: const Color(0xFFF8FAFC),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildSection('System Parameters'),
            _buildLabel('Rated Power (MW)'),
            _buildInput(_powerCtrl, 'MW'),
            const SizedBox(height: 12),
            _buildLabel('Rated Capacity (MWh)'),
            _buildInput(_capacityCtrl, 'MWh'),
            const SizedBox(height: 12),
            _buildLabel('Cycles per Year'),
            _buildInput(_cyclesCtrl, 'cycles/yr'),
            const SizedBox(height: 20),

            _buildSection('Electricity Prices (USD/MWh)'),
            _buildLabel('Peak Price (USD/MWh)'),
            _buildInput(_peakCtrl, '\$/MWh'),
            const SizedBox(height: 12),
            _buildLabel('Off-Peak Price (USD/MWh)'),
            _buildInput(_valleyCtrl, '\$/MWh'),
            const SizedBox(height: 20),

            _buildSection('Investment'),
            _buildLabel('CAPEX (USD/kWh)'),
            _buildInput(_capexCtrl, '\$/kWh'),
            const SizedBox(height: 24),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isCalc ? null : _calculate,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF8B5CF6),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: _isCalc
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Calculate Returns', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
              ),
            ),

            if (_result != null) ...[
              const SizedBox(height: 28),
              const Text('Results', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
              const SizedBox(height: 12),
              _buildResultGrid(),
              const SizedBox(height: 20),
              const Text('10-Year Cash Flow (USD M)', style: TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
              const SizedBox(height: 10),
              SizedBox(
                height: 180,
                child: BarChart(
                  values: (_result!['cashflows'] as List<dynamic>).cast<double>(),
                  labels: List.generate(10, (i) => 'Y${i + 1}'),
                  barColor: const Color(0xFF8B5CF6),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildSection(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
    );
  }

  Widget _buildLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(text, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
    );
  }

  Widget _buildInput(TextEditingController ctrl, String hint) {
    return TextField(
      controller: ctrl,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 13),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        filled: true,
        fillColor: Colors.white,
      ),
    );
  }

  Widget _buildResultGrid() {
    final items = [
      {'label': 'IRR', 'value': '${(_result!['irr'] as double).toStringAsFixed(2)}%', 'color': const Color(0xFF059669)},
      {'label': 'Annual Revenue', 'value': '\$${(_result!['annualRevenue'] as double).toStringAsFixed(2)}M', 'color': const Color(0xFF8B5CF6)},
      {'label': 'Arbitrage Volume', 'value': '${(_result!['arbitrageMwh'] as double).toStringAsFixed(0)} MWh/yr', 'color': const Color(0xFF0891B2)},
      {'label': 'Payback Period', 'value': '${(_result!['payback'] as double).toStringAsFixed(1)} yrs', 'color': const Color(0xFFEA580C)},
      {'label': 'Total CAPEX', 'value': '\$${(_result!['totalCapex'] as double).toStringAsFixed(1)}M', 'color': const Color(0xFF64748B)},
    ];

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 1.9,
      children: items.map((item) {
        final color = item['color'] as Color;
        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: color.withOpacity(0.07),
            border: Border.all(color: color.withOpacity(0.25)),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(item['label'] as String, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
              const SizedBox(height: 5),
              Text(item['value'] as String, style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: color)),
            ],
          ),
        );
      }).toList(),
    );
  }
}
