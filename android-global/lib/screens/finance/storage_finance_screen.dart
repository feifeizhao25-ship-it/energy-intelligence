import 'package:flutter/material.dart';
import '../../widgets/bar_chart.dart';
import '../../services/api_service.dart';

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
    try {
      final response = await ApiService.calcStorageFinance(
        powerMw: double.parse(_powerCtrl.text),
        capacityMwh: double.parse(_capacityCtrl.text),
        cyclesPerYear: double.parse(_cyclesCtrl.text),
        peakPricePerMwh: double.parse(_peakCtrl.text),
        offpeakPricePerMwh: double.parse(_valleyCtrl.text),
        capexPerKwh: double.parse(_capexCtrl.text),
      );
      if (mounted) {
        setState(
          () => _result = {
            'irr': (response['irr'] as num).toDouble(),
            'annualRevenue':
                (response['annual_revenue'] as num).toDouble() / 1e6,
            'arbitrageMwh': (response['annual_discharged_mwh'] as num)
                .toDouble(),
            'payback': (response['payback_years'] as num).toDouble(),
            'totalCapex': (response['total_capex'] as num).toDouble() / 1e6,
            'cashflows': ((response['cashflows'] as List?) ?? const [])
                .map((v) => (v as num).toDouble() / 1e6)
                .toList(),
            'assumptionVersion': response['assumption_version'],
          },
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              error is ApiException
                  ? error.message
                  : 'Storage calculation is temporarily unavailable.',
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isCalc = false);
    }
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
                        'Calculate Returns',
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
              const SizedBox(height: 8),
              Text(
                'Model: ${_result!['assumptionVersion']} · Based on your assumptions, not a market forecast.',
                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
              ),
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
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.bold,
          color: Color(0xFF0F172A),
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
        'label': 'Annual Revenue',
        'value':
            '\$${(_result!['annualRevenue'] as double).toStringAsFixed(2)}M',
        'color': const Color(0xFF8B5CF6),
      },
      {
        'label': 'Arbitrage Volume',
        'value':
            '${(_result!['arbitrageMwh'] as double).toStringAsFixed(0)} MWh/yr',
        'color': const Color(0xFF0891B2),
      },
      {
        'label': 'Payback Period',
        'value': '${(_result!['payback'] as double).toStringAsFixed(1)} yrs',
        'color': const Color(0xFFEA580C),
      },
      {
        'label': 'Total CAPEX',
        'value': '\$${(_result!['totalCapex'] as double).toStringAsFixed(1)}M',
        'color': const Color(0xFF64748B),
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
                  fontSize: 13,
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
