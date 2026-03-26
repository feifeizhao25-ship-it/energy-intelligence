import 'package:flutter/material.dart';

class MetricCard extends StatelessWidget {
  // Old android-global API
  final String? title;
  final String? value;
  final String? subtitle;
  final IconData? icon;
  final Color? color;

  // New ios-cn API
  final String? label;
  final String? unit;
  final String? trend;
  final double? changePercent;
  final Color? accentColor;

  final VoidCallback? onTap;

  const MetricCard({
    Key? key,
    this.title,
    this.value,
    this.subtitle,
    this.icon,
    this.color,
    this.label,
    this.unit,
    this.trend,
    this.changePercent,
    this.accentColor,
    this.onTap,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    // Support both old and new API
    final displayLabel = label ?? title ?? '';
    final displayValue = value ?? '';
    final displayUnit = unit ?? (subtitle ?? '');
    final displayIcon = icon ?? Icons.analytics;
    final displayAccent = accentColor ?? color ?? const Color(0xFF1D4ED8);
    final isPositive = trend == null || trend == 'up' || trend == 'neutral';
    final pct = changePercent ?? 0.0;

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: displayAccent.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(displayIcon, color: displayAccent, size: 20),
                  ),
                  if (changePercent != null || trend != null)
                    Row(
                      children: [
                        Icon(
                          isPositive ? Icons.trending_up : Icons.trending_down,
                          color: isPositive ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                          size: 16,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '${pct.toStringAsFixed(1)}%',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: isPositive ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                          ),
                        ),
                      ],
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                displayLabel,
                style: const TextStyle(
                  fontSize: 12,
                  color: Color(0xFF64748B),
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    displayValue,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(width: 4),
                  if (displayUnit.isNotEmpty)
                    Text(
                      displayUnit,
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
