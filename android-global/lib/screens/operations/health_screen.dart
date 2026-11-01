import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import 'dart:math' as math;

class HealthScreen extends StatelessWidget {
  const HealthScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Plant Health'),
        elevation: 0,
        backgroundColor: context.eiCard,
        foregroundColor: context.eiBody,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              decoration: BoxDecoration(
                color: context.eiCard,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: context.eiLine),
              ),
              padding: const EdgeInsets.all(24),
              child: Center(
                child: Column(
                  children: [
                    SizedBox(
                      width: 200,
                      height: 200,
                      child: CustomPaint(painter: HealthArcPainter(score: 84)),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Overall Health Score',
                      style: TextStyle(fontSize: 14, color: context.eiMuted),
                    ),
                    Text(
                      '84/100',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: context.eiBody,
                      ),
                    ),
                    const Text(
                      'Good condition',
                      style: TextStyle(fontSize: 12, color: Color(0xFF10B981)),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 28),
            Text(
              'Component Health',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: context.eiBody,
              ),
            ),
            const SizedBox(height: 12),
            _HealthBar(
              label: 'Generation',
              value: 87,
              color: const Color(0xFFFCD34D),
            ),
            const SizedBox(height: 12),
            _HealthBar(
              label: 'Equipment',
              value: 82,
              color: const Color(0xFF60A5FA),
            ),
            const SizedBox(height: 12),
            _HealthBar(
              label: 'Availability',
              value: 91,
              color: const Color(0xFF34D399),
            ),
            const SizedBox(height: 12),
            _HealthBar(
              label: 'Performance',
              value: 79,
              color: const Color(0xFFFB923C),
            ),
            const SizedBox(height: 12),
            _HealthBar(
              label: 'Maintenance',
              value: 84,
              color: const Color(0xFFF87171),
            ),
            const SizedBox(height: 28),
            Text(
              'Findings',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: context.eiBody,
              ),
            ),
            const SizedBox(height: 12),
            ...[
              {
                'severity': 'critical',
                'color': Colors.red,
                'title': 'Inverter Fault Detected',
                'subtitle': 'Unit A2 requires immediate attention',
              },
              {
                'severity': 'warning',
                'color': Colors.amber,
                'title': 'Soiling Detected',
                'subtitle': 'Panel efficiency reduced by 8%',
              },
              {
                'severity': 'info',
                'color': Colors.blue,
                'title': 'Maintenance Due',
                'subtitle': 'Cleaning recommended for Plant Delhi',
              },
            ].map((finding) {
              final color = finding['color'] as Color;
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Container(
                  decoration: BoxDecoration(
                    color: context.eiCard,
                    borderRadius: BorderRadius.circular(10),
                    border: Border(
                      left: BorderSide(color: color, width: 4),
                      right: BorderSide(color: context.eiLine),
                      top: BorderSide(color: context.eiLine),
                      bottom: BorderSide(color: context.eiLine),
                    ),
                  ),
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      Icon(Icons.error_outline, color: color, size: 20),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              finding['title'] as String,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: context.eiBody,
                              ),
                            ),
                            Text(
                              finding['subtitle'] as String,
                              style: TextStyle(
                                fontSize: 12,
                                color: context.eiMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}

class _HealthBar extends StatelessWidget {
  final String label;
  final int value;
  final Color color;

  const _HealthBar({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: context.eiBody,
              ),
            ),
            Text(
              '$value%',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: context.eiMuted,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: value / 100,
            minHeight: 6,
            backgroundColor: context.eiLine,
            valueColor: AlwaysStoppedAnimation<Color>(color),
          ),
        ),
      ],
    );
  }
}

class HealthArcPainter extends CustomPainter {
  final int score;
  HealthArcPainter({required this.score});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 20;

    final backgroundPaint = Paint()
      ..color = const Color(0xFFE2E8F0)
      ..strokeWidth = 12
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    final Color scoreColor;
    if (score >= 80) {
      scoreColor = const Color(0xFF10B981);
    } else if (score >= 60) {
      scoreColor = const Color(0xFFFCD34D);
    } else {
      scoreColor = const Color(0xFFF87171);
    }

    final foregroundPaint = Paint()
      ..color = scoreColor
      ..strokeWidth = 12
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    const startAngle = -math.pi / 2;
    const sweepAngle = 2 * math.pi;

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      startAngle,
      sweepAngle,
      false,
      backgroundPaint,
    );

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      startAngle,
      (sweepAngle * score / 100),
      false,
      foregroundPaint,
    );
  }

  @override
  bool shouldRepaint(HealthArcPainter oldDelegate) =>
      oldDelegate.score != score;
}
