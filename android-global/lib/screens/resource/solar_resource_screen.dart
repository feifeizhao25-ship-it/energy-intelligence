import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../widgets/bar_chart.dart';
import '../../services/mock_data.dart';

class SolarResourceScreen extends StatefulWidget {
  const SolarResourceScreen({super.key});
  @override
  State<SolarResourceScreen> createState() => _SolarResourceScreenState();
}

class _SolarResourceScreenState extends State<SolarResourceScreen> {
  final _latCtrl = TextEditingController(text: '28.7041');
  final _lngCtrl = TextEditingController(text: '77.1025');
  String _dataSource = 'NASA POWER';
  bool _loading = false;
  bool _showResults = false;

  @override
  void dispose() {
    _latCtrl.dispose();
    _lngCtrl.dispose();
    super.dispose();
  }

  Future<void> _assess() async {
    setState(() => _loading = true);
    await Future.delayed(const Duration(seconds: 2));
    if (!mounted) return;
    setState(() {
      _loading = false;
      _showResults = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Solar Resource'),
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E293B),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Location', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _latCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Latitude', hintText: '28.7041'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _lngCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Longitude', hintText: '77.1025'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Text('Data Source', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: _dataSource,
              decoration: const InputDecoration(labelText: 'Select Data Source'),
              items: ['NASA POWER', 'ERA5', 'NSRDB'].map((src) => DropdownMenuItem(value: src, child: Text(src))).toList(),
              onChanged: (val) => setState(() => _dataSource = val ?? 'NASA POWER'),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _loading ? null : _assess,
                child: _loading
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Assess Site'),
              ),
            ),
            if (_showResults) ...[
              const SizedBox(height: 28),
              const Text('Assessment Results', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
              const SizedBox(height: 12),
              Container(
                decoration: BoxDecoration(color: const Color(0xFFF0FDF4), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0x332A8644))),
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(color: const Color(0xFF16A34A), borderRadius: BorderRadius.circular(4)),
                      child: const Text('Class I', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white)),
                    ),
                    const SizedBox(width: 12),
                    const Text('Excellent solar resource', style: TextStyle(fontSize: 13, color: Color(0xFF1E293B))),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _ResultBox(label: 'GHI', value: '5.8 kWh/m²/d', color: const Color(0xFFFCD34D)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _ResultBox(label: 'DNI', value: '7.2 kWh/m²/d', color: const Color(0xFFFB923C)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _ResultBox(label: 'DHI', value: '2.1 kWh/m²/d', color: const Color(0xFF60A5FA)),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                padding: const EdgeInsets.all(16),
                child: BarChart(data: MockData.solarMonthlyGHI, title: 'Monthly GHI (kWh/m²)'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ResultBox extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _ResultBox({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
        ],
      ),
    );
  }
}
