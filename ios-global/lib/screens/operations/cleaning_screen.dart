import 'package:flutter/material.dart';
import 'dart:math';

class CleaningScreen extends StatefulWidget {
  const CleaningScreen({super.key});

  @override
  State<CleaningScreen> createState() => _CleaningScreenState();
}

class _CleaningScreenState extends State<CleaningScreen> {
  final _soilingCtrl = TextEditingController(text: '0.003');
  final _costCtrl = TextEditingController(text: '1200');
  final _revenueCtrl = TextEditingController(text: '18000');
  bool _isCalc = false;
  Map<String, dynamic>? _result;

  @override
  void dispose() {
    _soilingCtrl.dispose();
    _costCtrl.dispose();
    _revenueCtrl.dispose();
    super.dispose();
  }

  void _calculate() async {
    setState(() => _isCalc = true);
    await Future.delayed(const Duration(milliseconds: 500));

    final s = double.tryParse(_soilingCtrl.text) ?? 0.003;
    final C = double.tryParse(_costCtrl.text) ?? 1200.0; // USD
    final Rs = double.tryParse(_revenueCtrl.text) ?? 18000.0; // USD/day

    // Optimal interval: N* = sqrt(2C / (Rs × s))
    final nStar = sqrt(2 * C / (Rs * s));
    final nOptimal = nStar.round().clamp(1, 365);

    final dailyLoss = Rs * s;
    final lossBetweenCleans = dailyLoss * nOptimal * (nOptimal + 1) / 2;
    final cleaningsPerYear = (365 / nOptimal).floor();
    final annualCleaningCost = cleaningsPerYear * C;
    final annualLoss = cleaningsPerYear * lossBetweenCleans;

    final scenarios = [7, 14, 30, nOptimal].toSet().toList()..sort();
    final scenarioResults = scenarios.map((n) {
      final lossN = (365 / n).floor() * dailyLoss * n * (n + 1) / 2;
      final costN = (365 / n).floor() * C;
      return {'days': n, 'total': lossN + costN};
    }).toList();

    setState(() {
      _result = {
        'nOptimal': nOptimal,
        'nStar': nStar,
        'cleaningsPerYear': cleaningsPerYear,
        'annualCleaningCost': annualCleaningCost,
        'annualLoss': annualLoss,
        'totalAnnualCost': annualCleaningCost + annualLoss,
        'scenarios': scenarioResults,
      };
      _isCalc = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Cleaning Optimizer'),
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
            // Algorithm card
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF0F9FF),
                border: Border.all(color: const Color(0xFFBAE6FD)),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Optimal Cleaning Algorithm', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0369A1))),
                  SizedBox(height: 4),
                  Text('N* = √(2C / (Rₛ × s))\n\nC = cleaning cost per event, Rₛ = daily revenue, s = daily soiling rate', style: TextStyle(fontSize: 11, color: Color(0xFF0C4A6E), fontFamily: 'monospace')),
                ],
              ),
            ),
            const SizedBox(height: 20),

            _buildLabel('Daily Soiling Rate'),
            _buildInput(_soilingCtrl, 'e.g. 0.003 = 0.3% loss/day'),
            const SizedBox(height: 14),

            _buildLabel('Cleaning Cost per Event (USD)'),
            _buildInput(_costCtrl, 'USD'),
            const SizedBox(height: 14),

            _buildLabel('Daily Revenue (USD/day)'),
            _buildInput(_revenueCtrl, 'USD/day'),
            const SizedBox(height: 24),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isCalc ? null : _calculate,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1D4ED8),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: _isCalc
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Calculate Optimal Interval', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
              ),
            ),

            if (_result != null) ...[
              const SizedBox(height: 28),

              // Result highlight
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF1D4ED8), Color(0xFF06B6D4)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: [
                    const Text('Optimal Cleaning Interval', style: TextStyle(color: Colors.white70, fontSize: 13)),
                    const SizedBox(height: 8),
                    Text('${_result!['nOptimal']} days', style: const TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.bold)),
                    Text('N* = ${(_result!['nStar'] as double).toStringAsFixed(2)} days (theoretical)', style: const TextStyle(color: Colors.white70, fontSize: 11)),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 1.9,
                children: [
                  _buildStatCard('Cleanings/Year', '${_result!['cleaningsPerYear']}×', const Color(0xFF059669)),
                  _buildStatCard('Annual Cleaning Cost', '\$${((_result!['annualCleaningCost'] as double) / 1000).toStringAsFixed(1)}K', const Color(0xFFEA580C)),
                  _buildStatCard('Annual Soiling Loss', '\$${((_result!['annualLoss'] as double) / 1000).toStringAsFixed(1)}K', const Color(0xFFDC2626)),
                  _buildStatCard('Total Annual Cost', '\$${((_result!['totalAnnualCost'] as double) / 1000).toStringAsFixed(1)}K', const Color(0xFF7C3AED)),
                ],
              ),
              const SizedBox(height: 20),

              const Text('Schedule Comparison', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF0F172A))),
              const SizedBox(height: 10),
              ...(_result!['scenarios'] as List<dynamic>).map((s) {
                final days = s['days'] as int;
                final total = s['total'] as double;
                final isOpt = days == _result!['nOptimal'];
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: isOpt ? const Color(0xFFEFF6FF) : Colors.white,
                    border: Border.all(color: isOpt ? const Color(0xFF1D4ED8) : const Color(0xFFE2E8F0), width: isOpt ? 2 : 1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(children: [
                        Text('Every $days days', style: TextStyle(fontWeight: isOpt ? FontWeight.bold : FontWeight.normal)),
                        if (isOpt) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(color: const Color(0xFF1D4ED8), borderRadius: BorderRadius.circular(4)),
                            child: const Text('Optimal', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ]),
                      Text('\$${(total / 1000).toStringAsFixed(1)}K/yr', style: TextStyle(fontWeight: FontWeight.bold, color: isOpt ? const Color(0xFF1D4ED8) : const Color(0xFF0F172A))),
                    ],
                  ),
                );
              }),
            ],
          ],
        ),
      ),
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

  Widget _buildStatCard(String label, String value, Color color) {
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
          Text(label, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
          const SizedBox(height: 5),
          Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }
}
