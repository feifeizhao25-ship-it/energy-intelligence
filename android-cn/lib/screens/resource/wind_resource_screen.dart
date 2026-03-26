import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';
import '../../models/resource_assessment.dart';
import '../../widgets/site_score_card.dart';
import '../../widgets/bar_chart.dart';

class WindResourceScreen extends StatefulWidget {
  const WindResourceScreen({super.key});

  @override
  State<WindResourceScreen> createState() => _WindResourceScreenState();
}

class _WindResourceScreenState extends State<WindResourceScreen> {
  final _latController = TextEditingController();
  final _lngController = TextEditingController();
  ResourceAssessment? _result;
  bool _isLoading = false;

  @override
  void dispose() {
    _latController.dispose();
    _lngController.dispose();
    super.dispose();
  }

  void _handleQuery() async {
    if (_latController.text.isEmpty || _lngController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('请输入经纬度')));
      return;
    }

    setState(() => _isLoading = true);
    try {
      final result = await ApiService.getWindResource(
        double.parse(_latController.text),
        double.parse(_lngController.text),
      );
      setState(() {
        _result = ResourceAssessment.fromJson(result);
        _isLoading = false;
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('查询失败')));
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('风资源评估')),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('定位位置', style: Theme.of(context).textTheme.titleMedium),
                    SizedBox(height: 12),
                    TextField(
                      controller: _latController,
                      decoration: InputDecoration(
                        labelText: '纬度 (例: 41.0028)',
                        prefixIcon: Icon(Icons.location_on),
                      ),
                      keyboardType: TextInputType.numberWithOptions(decimal: true),
                    ),
                    SizedBox(height: 12),
                    TextField(
                      controller: _lngController,
                      decoration: InputDecoration(
                        labelText: '经度 (例: 113.1137)',
                        prefixIcon: Icon(Icons.location_on),
                      ),
                      keyboardType: TextInputType.numberWithOptions(decimal: true),
                    ),
                    SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _handleQuery,
                        child: _isLoading
                            ? SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                            : Text('查询评估'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (_isLoading)
              Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: Center(child: CircularProgressIndicator()),
              ),
            if (_result != null) ...[
              SizedBox(height: 24),
              SiteScoreCard(
                score: _result!.siteScore,
                grade: _result!.siteGrade,
                gradeColor: _convertGradeColor(_result!.siteGrade),
                recommendation: _result!.recommendation,
              ),
              SizedBox(height: 24),
              Text('资源数据', style: Theme.of(context).textTheme.headlineSmall),
              SizedBox(height: 12),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: NeverScrollableScrollPhysics(),
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                children: [
                  _buildDataCard('风速年均', '${_result!.windSpeedAnnual.toStringAsFixed(2)}', 'm/s'),
                  _buildDataCard('风能密度', '${_result!.windPowerDensity.toStringAsFixed(1)}', 'W/m²'),
                  _buildDataCard('Weibull k', '${_result!.weibullK.toStringAsFixed(2)}', '-'),
                  _buildDataCard('湍流强度', '${(_result!.turbulenceIntensity * 100).toStringAsFixed(1)}', '%'),
                ],
              ),
              SizedBox(height: 24),
              BarChart(
                title: '月均风速',
                values: _result!.windSpeedMonthly,
                labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
                barColor: Color(0xFF06B6D4),
                gradientStartColor: Color(0xFF06B6D4),
                gradientEndColor: Color(0xFF3B82F6),
              ),
              SizedBox(height: 24),
              BarChart(
                title: '月均温度',
                values: _result!.temperatureMonthly,
                labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
                barColor: Color(0xFFF59E0B),
              ),
              SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {},
                      icon: Icon(Icons.description_outlined),
                      label: Text('生成报告'),
                    ),
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {},
                      icon: Icon(Icons.bookmark_border),
                      label: Text('保存'),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildDataCard(String label, String value, String unit) {
    return Card(
      child: Padding(
        padding: EdgeInsets.all(12),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(label, style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
            SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                SizedBox(width: 4),
                Text(unit, style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Color _convertGradeColor(String grade) {
    switch (grade) {
      case 'A': return Color(0xFF10B981);
      case 'B': return Color(0xFF3B82F6);
      case 'C': return Color(0xFFF59E0B);
      default: return Color(0xFFEF4444);
    }
  }
}
