import 'package:flutter/material.dart';
import '../services/api_service.dart';

class CalculatorScreen extends StatefulWidget {
  const CalculatorScreen({super.key});

  @override
  State<CalculatorScreen> createState() => _CalculatorScreenState();
}

class _CalculatorScreenState extends State<CalculatorScreen> {
  final _capacityController = TextEditingController(text: '1000');
  final _priceController = TextEditingController(text: '0.4');
  String _projectType = 'solar';
  Map<String, dynamic>? _result;
  bool _calculating = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('收益计算器'),
        backgroundColor: Colors.blue[700],
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('项目类型', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 8),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'solar', label: Text('☀️ 光伏')),
                ButtonSegment(value: 'wind', label: Text('🌀 风电')),
                ButtonSegment(value: 'storage', label: Text('🔋 储能')),
              ],
              selected: {_projectType},
              onSelectionChanged: (s) => setState(() => _projectType = s.first),
            ),
            const SizedBox(height: 24),
            const Text('参数设置', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 12),
            TextField(
              controller: _capacityController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: '装机容量 (kW)',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.electric_bolt),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _priceController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: '电价 (元/kWh)',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.attach_money),
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _calculating ? null : _calculate,
              icon: _calculating 
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white))
                  : const Icon(Icons.calculate),
              label: Text(_calculating ? '计算中...' : '开始计算'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue[700],
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
            ),
            if (_result != null) ...[
              const SizedBox(height: 24),
              _buildResultCard(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildResultCard() {
    final data = _result!['data']?['outputs'] ?? _result!;
    
    return Card(
      color: Colors.blue[50],
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: const [
                Icon(Icons.analytics, color: Colors.blue),
                SizedBox(width: 8),
                Text('计算结果', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ],
            ),
            const Divider(),
            _buildResultRow('年发电量', '${data['annual_generation_kwh'] ?? '0'} kWh'),
            _buildResultRow('年均收益', '¥${data['annual_revenue_yuan'] ?? '0'}'),
            _buildResultRow('年均利润', '¥${data['annual_profit_yuan'] ?? '0'}'),
            _buildResultRow('IRR', '${data['irr_percent'] ?? '0'}%', highlight: true),
            _buildResultRow('回收期', '${data['payback_years'] ?? '0'} 年'),
            _buildResultRow('LCOE', '¥${data['lcoe_yuan_per_kwh'] ?? '0'}/kWh'),
            const Divider(),
            _buildResultRow('25年总利润', '¥${data['total_profit_25y_yuan'] ?? '0'}', highlight: true),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: (data['irr_percent'] ?? 0) >= 10 ? Colors.green[100] : Colors.orange[100],
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    (data['irr_percent'] ?? 0) >= 10 ? Icons.thumb_up : Icons.warning,
                    color: (data['irr_percent'] ?? 0) >= 10 ? Colors.green : Colors.orange,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    (data['irr_percent'] ?? 0) >= 10 ? '✅ 建议投资' : '⚠️ 建议进一步评估',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: (data['irr_percent'] ?? 0) >= 10 ? Colors.green[700] : Colors.orange[700],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildResultRow(String label, String value, {bool highlight = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.black87)),
          Text(
            value,
            style: TextStyle(
              fontWeight: highlight ? FontWeight.bold : FontWeight.normal,
              fontSize: highlight ? 16 : 14,
              color: highlight ? Colors.blue[700] : Colors.black,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _calculate() async {
    final capacity = int.tryParse(_capacityController.text) ?? 0;
    if (capacity <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请输入有效的装机容量')),
      );
      return;
    }

    setState(() {
      _calculating = true;
      _result = null;
    });

    try {
      final result = await ApiService.calculateROI(capacity.toDouble());
      
      setState(() {
        _result = result;
        _calculating = false;
      });
    } catch (e) {
      setState(() {
        _calculating = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('计算失败: $e')),
        );
      }
    }
  }
}
