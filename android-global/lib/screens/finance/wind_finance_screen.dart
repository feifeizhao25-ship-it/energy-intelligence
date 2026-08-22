import 'package:flutter/material.dart';
import '../../widgets/bar_chart.dart';
import '../../services/api_service.dart';

class WindFinanceScreen extends StatefulWidget {
  const WindFinanceScreen({super.key});

  @override
  State<WindFinanceScreen> createState() => _WindFinanceScreenState();
}

class _WindFinanceScreenState extends State<WindFinanceScreen> {
  int _currentStep = 0;
  final _capacityCtrl = TextEditingController(text: '100');
  final _cfCtrl = TextEditingController(text: '0.30');
  final _capexCtrl = TextEditingController(text: '1.4');
  final _opexCtrl = TextEditingController(text: '35');
  final _priceCtrl = TextEditingController(text: '45');
  bool _isCalc = false;
  Map<String, dynamic>? _result;

  @override
  void dispose() {
    _capacityCtrl.dispose();
    _cfCtrl.dispose();
    _capexCtrl.dispose();
    _opexCtrl.dispose();
    _priceCtrl.dispose();
    super.dispose();
  }

  void _calculate() async {
    setState(() => _isCalc = true);
    try {
      final capacity = double.parse(_capacityCtrl.text);
      final factor = double.parse(_cfCtrl.text);
      final response = await ApiService.calcWindFinance(
        capacityMw: capacity,
        capexPerKw: double.parse(_capexCtrl.text) * 1000,
        opexPerKwYr: double.parse(_opexCtrl.text),
        electricityPrice: double.parse(_priceCtrl.text),
        windCapacityFactor: factor,
      );
      if (mounted)
        setState(() {
          _result = {
            'irr': (response['irr'] as num).toDouble(),
            'npv': (response['npv'] as num).toDouble() / 1e6,
            'lcoe': (response['lcoe'] as num).toDouble(),
            'annualGen': capacity * factor * 8760,
            'payback': (response['payback_years'] as num).toDouble(),
            'cashflows': ((response['cashflows'] as List?) ?? const [])
                .take(10)
                .map((v) => (v as num).toDouble() / 1e6)
                .toList(),
          };
          _currentStep = 3;
        });
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              error is ApiException
                  ? error.message
                  : 'Financial calculation is temporarily unavailable.',
            ),
          ),
        );
    } finally {
      if (mounted) setState(() => _isCalc = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Wind Finance'),
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
            // Step progress
            Row(
              children: ['Project Specs', 'Pricing', 'Results']
                  .asMap()
                  .entries
                  .map((e) {
                    return Expanded(
                      child: Container(
                        margin: const EdgeInsets.symmetric(horizontal: 2),
                        height: 4,
                        decoration: BoxDecoration(
                          color: _currentStep >= e.key
                              ? const Color(0xFF1D4ED8)
                              : const Color(0xFFE2E8F0),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    );
                  })
                  .toList(),
            ),
            const SizedBox(height: 24),

            _buildLabel('Capacity (MW)'),
            _buildInput(_capacityCtrl, 'MW'),
            const SizedBox(height: 14),

            _buildLabel('Capacity Factor'),
            _buildInput(_cfCtrl, 'e.g. 0.30 = 30%'),
            const SizedBox(height: 14),

            _buildLabel('CAPEX (USD/kW in thousands)'),
            _buildInput(_capexCtrl, '\$/kW × 1000'),
            const SizedBox(height: 14),

            _buildLabel('OPEX (USD/kW/year)'),
            _buildInput(_opexCtrl, '\$/kW/yr'),
            const SizedBox(height: 14),

            _buildLabel('Power Purchase Price (USD/MWh)'),
            _buildInput(_priceCtrl, '\$/MWh'),
            const SizedBox(height: 24),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isCalc
                    ? null
                    : () {
                        setState(() => _currentStep = 1);
                        _calculate();
                      },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1D4ED8),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: _isCalc
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : const Text(
                        'Calculate',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
              ),
            ),

            if (_result != null) ...[
              const SizedBox(height: 28),
              const Text(
                'Results',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 12),
              _buildResultGrid(),
              const SizedBox(height: 20),
              const Text(
                '10-Year Cash Flow (USD M)',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                height: 180,
                child: BarChart(
                  values: (_result!['cashflows'] as List<dynamic>)
                      .cast<double>(),
                  labels: List.generate(10, (i) => 'Y${i + 1}'),
                  barColor: const Color(0xFF7C3AED),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: Color(0xFF374151),
        ),
      ),
    );
  }

  Widget _buildInput(TextEditingController ctrl, String hint) {
    return TextField(
      controller: ctrl,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 13),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 10,
        ),
        filled: true,
        fillColor: Colors.white,
      ),
    );
  }

  Widget _buildResultGrid() {
    final items = [
      {
        'label': 'IRR',
        'value': '${(_result!['irr'] as double).toStringAsFixed(2)}%',
        'color': const Color(0xFF059669),
      },
      {
        'label': 'NPV (8% discount)',
        'value': '\$${(_result!['npv'] as double).toStringAsFixed(2)}M',
        'color': const Color(0xFF1D4ED8),
      },
      {
        'label': 'LCOE',
        'value':
            '\$${((_result!['lcoe'] as double) * 1000).toStringAsFixed(1)}/MWh',
        'color': const Color(0xFF7C3AED),
      },
      {
        'label': 'Payback Period',
        'value': '${(_result!['payback'] as double).toStringAsFixed(1)} yrs',
        'color': const Color(0xFFEA580C),
      },
      {
        'label': 'Annual Generation',
        'value':
            '${((_result!['annualGen'] as double) / 1000).toStringAsFixed(1)} GWh',
        'color': const Color(0xFF0891B2),
      },
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
            color: color.withValues(alpha: 0.07),
            border: Border.all(color: color.withValues(alpha: 0.25)),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                item['label'] as String,
                style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 5),
              Text(
                item['value'] as String,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: color,
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}
