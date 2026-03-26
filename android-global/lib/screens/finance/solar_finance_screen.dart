import 'package:flutter/material.dart';
import 'dart:math';
import '../../theme/app_theme.dart';
import '../../widgets/bar_chart.dart';

class SolarFinanceScreen extends StatefulWidget {
  const SolarFinanceScreen({super.key});
  @override
  State<SolarFinanceScreen> createState() => _SolarFinanceScreenState();
}

class _SolarFinanceScreenState extends State<SolarFinanceScreen> {
  int _currentStep = 0;
  final _capacityCtrl = TextEditingController(text: '100');
  final _capexCtrl = TextEditingController(text: '1.2');
  final _opexCtrl = TextEditingController(text: '15');
  final _priceCtrl = TextEditingController(text: '80');
  final _itcCtrl = TextEditingController(text: '30');
  final _pricingCtrl = TextEditingController(text: 'Fixed');
  final _debtCtrl = TextEditingController(text: '60');
  final _interestCtrl = TextEditingController(text: '5');
  final _taxCtrl = TextEditingController(text: '25');

  late Map<String, dynamic> _results;
  bool _calculated = false;

  @override
  void dispose() {
    _capacityCtrl.dispose();
    _capexCtrl.dispose();
    _opexCtrl.dispose();
    _priceCtrl.dispose();
    _itcCtrl.dispose();
    _pricingCtrl.dispose();
    _debtCtrl.dispose();
    _interestCtrl.dispose();
    _taxCtrl.dispose();
    super.dispose();
  }

  double _calculateIRR(List<double> cashflows) {
    double rate = 0.1;
    for (int i = 0; i < 100; i++) {
      double npv = 0;
      double npvDeriv = 0;
      for (int year = 0; year < cashflows.length; year++) {
        npv += cashflows[year] / pow(1 + rate, year);
        if (year > 0) {
          npvDeriv -= year * cashflows[year] / pow(1 + rate, year + 1);
        }
      }
      if (npvDeriv == 0) break;
      final newRate = rate - npv / npvDeriv;
      if ((newRate - rate).abs() < 1e-6) return newRate * 100;
      rate = newRate;
    }
    return rate * 100;
  }

  void _calculate() {
    final capacity = double.tryParse(_capacityCtrl.text) ?? 100;
    final capex = double.tryParse(_capexCtrl.text) ?? 1.2;
    final opex = double.tryParse(_opexCtrl.text) ?? 15;
    final price = double.tryParse(_priceCtrl.text) ?? 80;
    final itc = double.tryParse(_itcCtrl.text) ?? 30;
    final debtRatio = double.tryParse(_debtCtrl.text) ?? 60;
    final interestRate = double.tryParse(_interestCtrl.text) ?? 5;
    final taxRate = double.tryParse(_taxCtrl.text) ?? 25;

    final initialCost = capacity * capex * 1e6;
    final annualGeneration = capacity * 1500;
    final annualRevenue = annualGeneration * 1000 * price / 1e6;
    final annualOpex = capacity * opex * 1e3 / 1e6;
    final equityRatio = 1 - debtRatio / 100;
    final debtCost = initialCost * (debtRatio / 100);
    final equityCost = initialCost * equityRatio;

    final List<double> cashflows = [-equityCost];
    for (int year = 1; year <= 25; year++) {
      double cf = annualRevenue - annualOpex;
      if (year <= 5) cf *= (1 - itc / 100);
      cf -= (debtCost / 25) * (interestRate / 100);
      cf *= (1 - taxRate / 100);
      if (year == 25) cf += capacity * capex * 0.5 * 1e6 / 1e6;
      cashflows.add(cf);
    }

    double npv = 0;
    for (int year = 0; year < cashflows.length; year++) {
      npv += cashflows[year] / pow(1.08, year);
    }

    final irr = _calculateIRR(cashflows);
    final lcoe = (initialCost + (annualOpex * 25)) / (annualGeneration * 1000 * 25) * 1e6;
    final payback = initialCost * equityRatio / (annualRevenue * 0.6);

    setState(() {
      _results = {
        'irr': irr.toStringAsFixed(1),
        'npv': npv.toStringAsFixed(1),
        'lcoe': (lcoe / 1e6).toStringAsFixed(3),
        'payback': payback.toStringAsFixed(1),
        'cashflows': cashflows,
      };
      _calculated = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Solar Financial Model'),
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E293B),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stepper(
              currentStep: _currentStep,
              onStepContinue: _currentStep < 3 ? () => setState(() => _currentStep++) : _calculate,
              onStepCancel: _currentStep > 0 ? () => setState(() => _currentStep--) : null,
              controlsBuilder: (context, details) {
                return Padding(
                  padding: const EdgeInsets.only(top: 16),
                  child: Row(
                    children: [
                      ElevatedButton(onPressed: details.onStepContinue, child: Text(_currentStep == 3 ? 'Calculate' : 'Continue')),
                      if (details.onStepCancel != null) ...[
                        const SizedBox(width: 8),
                        OutlinedButton(onPressed: details.onStepCancel, child: const Text('Back')),
                      ],
                    ],
                  ),
                );
              },
              steps: [
                Step(
                  title: const Text('Project Parameters'),
                  isActive: _currentStep >= 0,
                  content: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      TextField(controller: _capacityCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Capacity (MW)', hintText: '100')),
                      const SizedBox(height: 12),
                      TextField(controller: _capexCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: r'CapEx ($/W)', hintText: '1.2')),
                      const SizedBox(height: 12),
                      TextField(controller: _opexCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: r'OpEx ($/kW/yr)', hintText: '15')),
                    ],
                  ),
                ),
                Step(
                  title: const Text('Revenue & Incentives'),
                  isActive: _currentStep >= 1,
                  content: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      TextField(controller: _priceCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Electricity Price (\$/MWh)', hintText: '80')),
                      const SizedBox(height: 12),
                      TextField(controller: _itcCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'ITC Rate (%)', hintText: '30')),
                      const SizedBox(height: 12),
                      TextField(controller: _pricingCtrl, readOnly: true, decoration: const InputDecoration(labelText: 'Pricing Structure', hintText: 'Fixed')),
                    ],
                  ),
                ),
                Step(
                  title: const Text('Financing'),
                  isActive: _currentStep >= 2,
                  content: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      TextField(controller: _debtCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Debt Ratio (%)', hintText: '60')),
                      const SizedBox(height: 12),
                      TextField(controller: _interestCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Interest Rate (%)', hintText: '5')),
                      const SizedBox(height: 12),
                      TextField(controller: _taxCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Tax Rate (%)', hintText: '25')),
                    ],
                  ),
                ),
                Step(
                  title: const Text('Review Results'),
                  isActive: _currentStep >= 3,
                  content: _calculated
                      ? Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: _ResultCard(label: 'IRR', value: '${_results['irr']}%', color: const Color(0xFF34D399)),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: _ResultCard(label: 'NPV', value: '\$${_results['npv']}M', color: const Color(0xFF60A5FA)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Expanded(
                                  child: _ResultCard(label: 'LCOE', value: '\$${_results['lcoe']}/kWh', color: const Color(0xFFFCD34D)),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: _ResultCard(label: 'Payback', value: '${_results['payback']} yr', color: const Color(0xFFF87171)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 20),
                            const Text('25-Year Cashflow', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                            const SizedBox(height: 12),
                            Container(
                              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE2E8F0))),
                              padding: const EdgeInsets.all(16),
                              child: BarChart(
                                data: List.generate(
                                  _results['cashflows'].length,
                                  (i) => (_results['cashflows'][i] as num).toDouble(),
                                ),
                                title: '25-Year Cashflow (Equity, \$M)',
                              ),
                            ),
                          ],
                        )
                      : const SizedBox(),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ResultCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _ResultCard({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(10), border: Border.all(color: color.withOpacity(0.3))),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
        ],
      ),
    );
  }
}
