import 'package:flutter/material.dart';
import 'dart:math' as math;

class BarChart extends StatelessWidget {
  final List<double> values;
  final List<String> labels;
  final Color barColor;
  final Color? gradientStartColor;
  final Color? gradientEndColor;
  final double maxValue;
  final String? title;
  final String? yAxisLabel;

  // Support both `data` (alias for values) and `values`
  final List<double>? data;

  const BarChart({
    Key? key,
    this.values = const [],
    this.labels = const [],
    this.barColor = const Color(0xFF1D4ED8),
    this.gradientStartColor,
    this.gradientEndColor,
    this.maxValue = 0,
    this.title,
    this.yAxisLabel,
    this.data,
  }) : super(key: key);

  List<double> get _values => data ?? values;
  List<String> get _labels {
    if (labels.isNotEmpty) return labels;
    return List.generate(_values.length, (i) => '${i + 1}');
  }

  @override
  Widget build(BuildContext context) {
    final vals = _values;
    final max = maxValue > 0 ? maxValue : (vals.isNotEmpty ? vals.reduce(math.max) : 100.0);

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (title != null) ...[
              Text(
                title!,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 16),
            ],
            SizedBox(
              height: 240,
              child: CustomPaint(
                painter: _BarChartPainter(
                  values: vals,
                  labels: _labels,
                  barColor: barColor,
                  gradientStartColor: gradientStartColor,
                  gradientEndColor: gradientEndColor,
                  maxValue: max,
                ),
                size: Size.infinite,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BarChartPainter extends CustomPainter {
  final List<double> values;
  final List<String> labels;
  final Color barColor;
  final Color? gradientStartColor;
  final Color? gradientEndColor;
  final double maxValue;

  _BarChartPainter({
    required this.values,
    required this.labels,
    required this.barColor,
    this.gradientStartColor,
    this.gradientEndColor,
    required this.maxValue,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty) return;

    final padding = const EdgeInsets.only(left: 40, right: 20, top: 20, bottom: 40);
    final chartWidth = size.width - padding.left - padding.right;
    final chartHeight = size.height - padding.top - padding.bottom;

    final gridLinePaint = Paint()
      ..color = const Color(0xFFE2E8F0)
      ..strokeWidth = 1;

    for (int i = 1; i < 5; i++) {
      final y = padding.top + (chartHeight / 4) * i;
      canvas.drawLine(
        Offset(padding.left, y),
        Offset(size.width - padding.right, y),
        gridLinePaint,
      );
    }

    final barWidth = chartWidth / values.length * 0.7;
    final barSpacing = chartWidth / values.length;

    for (int i = 0; i < values.length; i++) {
      final value = values[i];
      final barHeight = (value / maxValue) * chartHeight;
      final x = padding.left + (i + 0.5) * barSpacing - barWidth / 2;
      final y = padding.top + chartHeight - barHeight;

      final barPaint = Paint()
        ..color = barColor
        ..style = PaintingStyle.fill;

      if (gradientStartColor != null && gradientEndColor != null) {
        barPaint.shader = LinearGradient(
          colors: [gradientStartColor!, gradientEndColor!],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ).createShader(Rect.fromLTWH(x, y, barWidth, barHeight));
      }

      final borderRadius = Radius.circular(4);
      canvas.drawRRect(
        RRect.fromRectAndCorners(
          Rect.fromLTWH(x, y, barWidth, barHeight),
          topLeft: borderRadius,
          topRight: borderRadius,
        ),
        barPaint,
      );

      final valueTextPainter = TextPainter(
        text: TextSpan(
          text: value.toStringAsFixed(0),
          style: const TextStyle(
            color: Color(0xFF475569),
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
        ),
        textDirection: TextDirection.ltr,
      );
      valueTextPainter.layout();
      valueTextPainter.paint(
        canvas,
        Offset(
          x + barWidth / 2 - valueTextPainter.width / 2,
          y - 18,
        ),
      );
    }

    for (int i = 0; i < labels.length; i++) {
      final labelTextPainter = TextPainter(
        text: TextSpan(
          text: labels[i],
          style: const TextStyle(
            color: Color(0xFF64748B),
            fontSize: 11,
          ),
        ),
        textDirection: TextDirection.ltr,
      );
      labelTextPainter.layout();
      final x = padding.left + (i + 0.5) * barSpacing - labelTextPainter.width / 2;
      final y = size.height - padding.bottom + 8;
      labelTextPainter.paint(canvas, Offset(x, y));
    }

    final axisLinePaint = Paint()
      ..color = const Color(0xFFCBD5E1)
      ..strokeWidth = 1;

    canvas.drawLine(
      Offset(padding.left, padding.top),
      Offset(padding.left, size.height - padding.bottom),
      axisLinePaint,
    );
    canvas.drawLine(
      Offset(padding.left, size.height - padding.bottom),
      Offset(size.width, size.height - padding.bottom),
      axisLinePaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
