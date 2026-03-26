import 'package:flutter/material.dart';
import 'dart:math' as math;
import '../../theme/app_theme.dart';
import '../../widgets/bar_chart.dart';
import '../../services/mock_data.dart';

class WindResourceScreen extends StatefulWidget {
  const WindResourceScreen({super.key});
  @override
  State<WindResourceScreen> createState() => _WindResourceScreenState();
}

class _WindResourceScreenState extends State<WindResourceScreen> {
  final _latCtrl = TextEditingController(text: '28.7041');
  final _lngCtrl = TextEditingController(text: '77.1025');
  String _hubHeight = '100m';
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
        title: const Text('Wind Resource'),
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
            const Text('Hub Height', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: _hubHeight,
              decoration: const InputDecoration(labelText: 'Select Hub Height'),
              items: ['80m', '100m', '120m', '150m'].map((h) => DropdownMenuItem(value: h, child: Text(h))).toList(),
              onChanged: (val) => setState(() => _hubHeight = val ?? '100m'),
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
              const Text('Wind Rose Analysis', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
              const SizedBox(height: 12),
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                padding: const EdgeInsets.all(20),
                child: CustomPaint(
                  size: const Size(double.infinity, 280),
                  painter: WindRosePainter(),
                ),
              ),
              const SizedBox(height: 24),
              const Text('Weibull Parameters', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(color: const Color(0xFFF0F9FF), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFBAE6FD))),
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text('Scale (A)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                          SizedBox(height: 4),
                          Text('8.4 m/s', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(color: const Color(0xFFF0FDF4), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0x332A8644))),
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text('Shape (k)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                          SizedBox(height: 4),
                          Text('2.1', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
                        ],
                      ),
                    ),
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
                child: BarChart(data: MockData.windMonthlySpeed, title: 'Monthly Average Speed (m/s)'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class WindRosePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2.5;

    final paint = Paint()..color = const Color(0xFFE2E8F0)..strokeWidth = 1;
    final textPainter = TextPainter(textDirection: TextDirection.ltr);

    // Draw circles
    for (int i = 1; i <= 3; i++) {
      canvas.drawCircle(center, radius * i / 3, paint);
    }

    // Draw wind directions
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    for (int i = 0; i < 8; i++) {
      final angle = (i * 45 - 90) * math.pi / 180;
      final x = center.dx + radius * math.cos(angle);
      final y = center.dy + radius * math.sin(angle);
      canvas.drawLine(center, Offset(x, y), paint);

      textPainter.text = TextSpan(text: directions[i], style: const TextStyle(color: Color(0xFF64748B), fontSize: 12));
      textPainter.layout();
      final offset = Offset(x + 5 - textPainter.width / 2, y + 5 - textPainter.height / 2);
      textPainter.paint(canvas, offset);
    }

    // Draw wind speed distribution (example data)
    final primaryPaint = Paint()
      ..color = AppTheme.primary.withOpacity(0.6)
      ..style = PaintingStyle.fill;

    for (int i = 0; i < 8; i++) {
      final angle = (i * 45 - 90) * math.pi / 180;
      final nextAngle = ((i + 1) * 45 - 90) * math.pi / 180;
      final dist = radius * (0.4 + (i % 3) * 0.2);
      final nextDist = radius * (0.4 + ((i + 1) % 3) * 0.2);

      final p1 = Offset(center.dx + dist * math.cos(angle), center.dy + dist * math.sin(angle));
      final p2 = Offset(center.dx + nextDist * math.cos(nextAngle), center.dy + nextDist * math.sin(nextAngle));
      final p3 = Offset(center.dx + (radius * 0.1) * math.cos(nextAngle), center.dy + (radius * 0.1) * math.sin(nextAngle));
      final p4 = Offset(center.dx + (radius * 0.1) * math.cos(angle), center.dy + (radius * 0.1) * math.sin(angle));

      canvas.drawPath(Path()..addPolygon([p1, p2, p3, p4], true), primaryPaint);
    }
  }

  @override
  bool shouldRepaint(WindRosePainter oldDelegate) => false;
}
