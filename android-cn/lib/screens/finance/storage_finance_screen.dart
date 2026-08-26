import 'package:flutter/material.dart';
import '../../widgets/bar_chart.dart';
import '../../services/api_service.dart';

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
    try {
      final response = await ApiService.calcStorageFinance(
        powerMw: double.parse(_powerController.text),
        capacityMwh: double.parse(_capacityController.text),
        cyclesPerYear: double.parse(_cyclesController.text),
        peakPricePerMwh: double.parse(_peakPriceController.text) * 1000,
        offpeakPricePerMwh: double.parse(_valleyPriceController.text) * 1000,
        capexPerKwh: double.parse(_capexController.text) * 10,
      );
      if (!mounted) return;
      setState(() {
        _result = {
          'irr': (response['irr'] as num).toDouble(),
          'annualRevenue':
              (response['annual_revenue'] as num).toDouble() / 10000,
          'annualArbitrage': (response['annual_discharged_mwh'] as num)
              .toDouble(),
          'payback': (response['payback_years'] as num).toDouble(),
          'totalCapex': (response['total_capex'] as num).toDouble() / 10000,
          'cashflows': ((response['cashflows'] as List?) ?? const [])
              .map((value) => (value as num).toDouble() / 10000)
              .toList(),
          'assumptionVersion': response['assumption_version'],
        };
      });
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error is ApiException ? error.message : '储能测算服务暂时不可用'),
        ),
      );
    } finally {
      if (mounted) setState(() => _isCalculating = false);
    }
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
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: _isCalculating
                    ? Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          ),
                          SizedBox(width: 12),
                          Text('计算中...'),
                        ],
                      )
                    : Text(
                        '计算储能收益',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
              ),
            ),

            if (_result != null) ...[
              SizedBox(height: 32),
              _buildSectionTitle('储能收益分析结果'),
              SizedBox(height: 16),
              _buildResultCards(),
              SizedBox(height: 24),
              Text(
                '10年现金流 (万元)',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0F172A),
                ),
              ),
              SizedBox(height: 12),
              SizedBox(
                height: 200,
                child: BarChart(
                  values: (_result!['cashflows'] as List<dynamic>)
                      .map((e) => (e as double))
                      .toList(),
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
      style: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.bold,
        color: Color(0xFF0F172A),
      ),
    );
  }

  Widget _buildTextField(
    String label,
    TextEditingController controller,
    String suffix,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 13,
            color: Color(0xFF64748B),
            fontWeight: FontWeight.w500,
          ),
        ),
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
      {
        'label': '项目IRR',
        'value': '${(_result!['irr'] as double).toStringAsFixed(2)}%',
        'color': Color(0xFF059669),
      },
      {
        'label': '年套利收益',
        'value':
            '${(_result!['annualRevenue'] as double).toStringAsFixed(0)} 万元',
        'color': Color(0xFF8B5CF6),
      },
      {
        'label': '峰谷套利量',
        'value':
            '${(_result!['annualArbitrage'] as double).toStringAsFixed(0)} MWh/年',
        'color': Color(0xFF0891B2),
      },
      {
        'label': '投资回收期',
        'value': '${(_result!['payback'] as double).toStringAsFixed(1)} 年',
        'color': Color(0xFFEA580C),
      },
      {
        'label': '总投资额',
        'value': '${(_result!['totalCapex'] as double).toStringAsFixed(0)} 万元',
        'color': Color(0xFF64748B),
      },
    ];

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.8,
      children: items
          .map(
            (item) => Container(
              padding: EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: (item['color'] as Color).withValues(alpha: 0.08),
                border: Border.all(
                  color: (item['color'] as Color).withValues(alpha: 0.3),
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    item['label'] as String,
                    style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                  ),
                  SizedBox(height: 6),
                  Text(
                    item['value'] as String,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: item['color'] as Color,
                    ),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}
