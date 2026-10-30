import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';
import '../../models/financial_model.dart';
import '../../widgets/bar_chart.dart';

class SolarFinanceScreen extends StatefulWidget {
  const SolarFinanceScreen({super.key});

  @override
  State<SolarFinanceScreen> createState() => _SolarFinanceScreenState();
}

class _SolarFinanceScreenState extends State<SolarFinanceScreen> {
  int _currentStep = 0;
  final _capacityController = TextEditingController(text: '100');
  final _ghiController = TextEditingController(text: '1456.8');
  final _prController = TextEditingController(text: '0.78');
  final _capexController = TextEditingController(text: '48500');
  final _opexController = TextEditingController(text: '287.5');
  final _electricityController = TextEditingController(text: '0.35');
  FinancialModel? _result;
  bool _isCalculating = false;

  @override
  void dispose() {
    _capacityController.dispose();
    _ghiController.dispose();
    _prController.dispose();
    _capexController.dispose();
    _opexController.dispose();
    _electricityController.dispose();
    super.dispose();
  }

  void _calculate() async {
    setState(() => _isCalculating = true);
    try {
      final result = await ApiService.calcSolarFinance(
        legacyParams: {
          'capacityMwp': double.parse(_capacityController.text),
          'ghiAnnual': double.parse(_ghiController.text),
          'pr': double.parse(_prController.text),
          'capexTotal': double.parse(_capexController.text),
          'opexAnnual': double.parse(_opexController.text),
          'electricityPrice': double.parse(_electricityController.text),
        },
      );
      if (!mounted) return;
      setState(() {
        _result = FinancialModel.fromJson(result);
        _currentStep = 3;
        _isCalculating = false;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('计算失败')));
      setState(() => _isCalculating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('光伏财务计算')),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          children: [
            _buildStepIndicator(),
            SizedBox(height: 24),
            if (_currentStep == 0) _buildStep1(),
            if (_currentStep == 1) _buildStep2(),
            if (_currentStep == 2) _buildStep3(),
            if (_currentStep == 3 && _result != null) _buildResults(),
            SizedBox(height: 24),
            _buildActionButtons(),
          ],
        ),
      ),
    );
  }

  Widget _buildStepIndicator() {
    final track = Theme.of(context).colorScheme.outlineVariant;
    final children = <Widget>[];
    for (var i = 0; i < 4; i++) {
      final isActive = _currentStep >= i;
      children.add(
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: isActive ? AppTheme.primaryColor : track,
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text(
              '${i + 1}',
              style: TextStyle(
                color: isActive ? Colors.white : Color(0xFF94A3B8),
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
      );
      if (i < 3) {
        children.add(
          Expanded(
            child: Container(
              height: 2,
              color: _currentStep > i ? AppTheme.primaryColor : track,
            ),
          ),
        );
      }
    }
    return Row(children: children);
  }

  Widget _buildStep1() {
    return Card(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('项目基础信息', style: Theme.of(context).textTheme.titleMedium),
            SizedBox(height: 16),
            TextField(
              controller: _capacityController,
              decoration: InputDecoration(labelText: '装机容量 (MWp)'),
              keyboardType: TextInputType.numberWithOptions(decimal: true),
            ),
            SizedBox(height: 12),
            TextField(
              controller: _ghiController,
              decoration: InputDecoration(labelText: '年均水平面总辐照量 (kWh/m²)'),
              keyboardType: TextInputType.numberWithOptions(decimal: true),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStep2() {
    return Card(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('性能参数', style: Theme.of(context).textTheme.titleMedium),
            SizedBox(height: 16),
            TextField(
              controller: _prController,
              decoration: InputDecoration(labelText: '性能系数'),
              keyboardType: TextInputType.numberWithOptions(decimal: true),
            ),
            SizedBox(height: 12),
            Text(
              '衰减率: 0.5%/年',
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
            Text(
              '直流/交流容配比: 1.2',
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStep3() {
    return Card(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('成本与电价', style: Theme.of(context).textTheme.titleMedium),
            SizedBox(height: 16),
            TextField(
              controller: _capexController,
              decoration: InputDecoration(labelText: '初始投资总额 (万元)'),
              keyboardType: TextInputType.numberWithOptions(decimal: true),
            ),
            SizedBox(height: 12),
            TextField(
              controller: _opexController,
              decoration: InputDecoration(labelText: '年运维成本 (万元)'),
              keyboardType: TextInputType.numberWithOptions(decimal: true),
            ),
            SizedBox(height: 12),
            TextField(
              controller: _electricityController,
              decoration: InputDecoration(labelText: '电价 (元/kWh)'),
              keyboardType: TextInputType.numberWithOptions(decimal: true),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildResults() {
    return Column(
      children: [
        Text('计算结果', style: Theme.of(context).textTheme.headlineSmall),
        SizedBox(height: 16),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          children: [
            _buildResultCard(
              '内部收益率',
              '${_result!.irrEquity.toStringAsFixed(2)}%',
              Color(0xFF10B981),
            ),
            _buildResultCard(
              '净现值',
              '¥${_result!.npv.toStringAsFixed(1)}M',
              Color(0xFF3B82F6),
            ),
            _buildResultCard(
              '度电成本',
              '¥${_result!.lcoe.toStringAsFixed(4)}/kWh',
              Color(0xFFF59E0B),
            ),
            _buildResultCard(
              '投资回收',
              '${_result!.paybackStatic.toStringAsFixed(1)}年',
              Color(0xFF06B6D4),
            ),
          ],
        ),
        SizedBox(height: 24),
        BarChart(
          title: '25年现金流预测',
          values: _result!.annualCashflow.take(10).toList(),
          labels: ['初期', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
          barColor: AppTheme.primaryColor,
          gradientStartColor: AppTheme.primaryColor,
          gradientEndColor: Color(0xFF06B6D4),
        ),
      ],
    );
  }

  Widget _buildResultCard(String label, String value, Color color) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              label,
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
            SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: color,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButtons() {
    return Column(
      children: [
        if (_currentStep < 3)
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                if (_currentStep < 2) {
                  setState(() => _currentStep++);
                } else {
                  _calculate();
                }
              },
              child: _isCalculating
                  ? SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(_currentStep == 2 ? '计算结果' : '下一步'),
            ),
          ),
        if (_currentStep > 0 && _currentStep < 3)
          Padding(
            padding: EdgeInsets.only(top: 12),
            child: SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => setState(() => _currentStep--),
                child: Text('上一步'),
              ),
            ),
          ),
      ],
    );
  }
}
