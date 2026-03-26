import 'package:flutter/material.dart';
import 'dart:math' as math;

class CleaningScreen extends StatefulWidget {
  const CleaningScreen({super.key});

  @override
  State<CleaningScreen> createState() => _CleaningScreenState();
}

class _CleaningScreenState extends State<CleaningScreen> {
  final _soilingRateController = TextEditingController(text: '0.003');
  final _cleaningCostController = TextEditingController(text: '8000');
  final _revenueController = TextEditingController(text: '120000');
  bool _isCalculating = false;
  Map<String, dynamic>? _result;

  @override
  void dispose() {
    _soilingRateController.dispose();
    _cleaningCostController.dispose();
    _revenueController.dispose();
    super.dispose();
  }

  void _calculate() async {
    setState(() => _isCalculating = true);
    await Future.delayed(Duration(milliseconds: 500));

    final s = double.tryParse(_soilingRateController.text) ?? 0.003; // 日积灰率
    final C = double.tryParse(_cleaningCostController.text) ?? 8000; // 单次清洗成本 元
    final Rs = double.tryParse(_revenueController.text) ?? 120000; // 日发电收益 元

    // Optimal cleaning interval: N* = sqrt(2C / (Rs × s))
    final nStar = math.sqrt(2 * C / (Rs * s));
    final nOptimal = nStar.round().clamp(1, 365);

    // Annual loss with optimal schedule
    final dailyLoss = Rs * s;
    final lossBetweenCleans = dailyLoss * nOptimal * (nOptimal + 1) / 2;
    final cleaningsPerYear = (365 / nOptimal).floor();
    final annualCleaningCost = cleaningsPerYear * C;
    final annualLoss = cleaningsPerYear * lossBetweenCleans;

    // Compare with fixed schedules
    final scenarios = [7, 14, 30, nOptimal].toSet().toList()..sort();
    final scenarioResults = scenarios.map((n) {
      final lossN = (365 / n).floor() * dailyLoss * n * (n + 1) / 2;
      final costN = (365 / n).floor() * C.toDouble();
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
      _isCalculating = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('清洗决策优化'),
        backgroundColor: const Color(0xFF1D4ED8),
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Algorithm explanation
            Container(
              padding: EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Color(0xFFF0F9FF),
                border: Border.all(color: Color(0xFFBAE6FD)),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('最优清洗周期算法', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0369A1))),
                  SizedBox(height: 4),
                  Text(
                    'N* = √(2C / (Rs × s))\n\nC=单次清洗成本, Rs=日发电收益, s=日积灰率',
                    style: TextStyle(fontSize: 12, color: Color(0xFF0C4A6E), fontFamily: 'monospace'),
                  ),
                ],
              ),
            ),
            SizedBox(height: 24),

            Text('日积灰率', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
            SizedBox(height: 8),
            TextField(
              controller: _soilingRateController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                contentPadding: EdgeInsets.all(12),
                hintText: '如 0.003 表示每天损失0.3%发电量',
              ),
            ),
            SizedBox(height: 16),
            Text('单次清洗成本 (元)', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
            SizedBox(height: 8),
            TextField(
              controller: _cleaningCostController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                contentPadding: EdgeInsets.all(12),
                suffixText: '元',
              ),
            ),
            SizedBox(height: 16),
            Text('日均发电收益 (元)', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
            SizedBox(height: 8),
            TextField(
              controller: _revenueController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                contentPadding: EdgeInsets.all(12),
                suffixText: '元/天',
              ),
            ),
            SizedBox(height: 24),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isCalculating ? null : _calculate,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Color(0xFF1D4ED8),
                  foregroundColor: Colors.white,
                  padding: EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: _isCalculating
                    ? CircularProgressIndicator(color: Colors.white, strokeWidth: 2)
                    : Text('计算最优清洗周期', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ),
            ),

            if (_result != null) ...[
              SizedBox(height: 32),

              // Optimal result highlight
              Container(
                padding: EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF1D4ED8), Color(0xFF06B6D4)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: [
                    Text('最优清洗周期', style: TextStyle(color: Colors.white70, fontSize: 13)),
                    SizedBox(height: 8),
                    Text(
                      '${_result!['nOptimal']} 天',
                      style: TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      'N* = ${(_result!['nStar'] as double).toStringAsFixed(2)} 天 (理论值)',
                      style: TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                  ],
                ),
              ),
              SizedBox(height: 16),

              // Stats grid
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: NeverScrollableScrollPhysics(),
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.8,
                children: [
                  _buildStatCard('年清洗次数', '${_result!['cleaningsPerYear']} 次', Color(0xFF059669)),
                  _buildStatCard('年清洗成本', '${((_result!['annualCleaningCost'] as double) / 10000).toStringAsFixed(1)} 万元', Color(0xFFEA580C)),
                  _buildStatCard('年积灰损失', '${((_result!['annualLoss'] as double) / 10000).toStringAsFixed(1)} 万元', Color(0xFFDC2626)),
                  _buildStatCard('年综合成本', '${((_result!['totalAnnualCost'] as double) / 10000).toStringAsFixed(1)} 万元', Color(0xFF7C3AED)),
                ],
              ),
              SizedBox(height: 24),

              // Scenario comparison
              Text('不同策略对比', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF0F172A))),
              SizedBox(height: 12),
              ...(_result!['scenarios'] as List<dynamic>).map((s) {
                final days = s['days'] as int;
                final total = s['total'] as double;
                final isOptimal = days == _result!['nOptimal'];
                return Container(
                  margin: EdgeInsets.only(bottom: 8),
                  padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: isOptimal ? Color(0xFFEFF6FF) : Colors.white,
                    border: Border.all(
                      color: isOptimal ? Color(0xFF1D4ED8) : Color(0xFFE2E8F0),
                      width: isOptimal ? 2 : 1,
                    ),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Text('每 $days 天清洗', style: TextStyle(fontWeight: isOptimal ? FontWeight.bold : FontWeight.normal)),
                          if (isOptimal) ...[SizedBox(width: 8), Container(padding: EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: Color(0xFF1D4ED8), borderRadius: BorderRadius.circular(4)), child: Text('最优', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)))],
                        ],
                      ),
                      Text(
                        '${(total / 10000).toStringAsFixed(1)} 万元/年',
                        style: TextStyle(fontWeight: FontWeight.bold, color: isOptimal ? Color(0xFF1D4ED8) : Color(0xFF0F172A)),
                      ),
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

  Widget _buildStatCard(String label, String value, Color color) {
    return Container(
      padding: EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        border: Border.all(color: color.withOpacity(0.3)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label, style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
          SizedBox(height: 6),
          Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }
}
