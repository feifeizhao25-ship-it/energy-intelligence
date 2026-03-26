import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';
import '../../models/diagnostic_report.dart';
import 'dart:math' as math;

class HealthScreen extends StatefulWidget {
  const HealthScreen({super.key});

  @override
  State<HealthScreen> createState() => _HealthScreenState();
}

class _HealthScreenState extends State<HealthScreen> {
  DiagnosticReport? _report;
  bool _isLoading = false;
  String _selectedProject = 'proj_001';

  @override
  void initState() {
    super.initState();
    _loadReport();
  }

  void _loadReport() async {
    setState(() => _isLoading = true);
    try {
      final report = await ApiService.getHealthReport(_selectedProject);
      setState(() {
        _report = DiagnosticReport.fromJson(report);
        _isLoading = false;
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('加载失败')));
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('电站健康诊断')),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('选择项目', style: Theme.of(context).textTheme.titleMedium),
            SizedBox(height: 12),
            Container(
              padding: EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                border: Border.all(color: Color(0xFFE2E8F0)),
                borderRadius: BorderRadius.circular(8),
              ),
              child: DropdownButton<String>(
                value: _selectedProject,
                isExpanded: true,
                underline: SizedBox(),
                onChanged: (value) {
                  if (value != null) {
                    setState(() => _selectedProject = value);
                    _loadReport();
                  }
                },
                items: [
                  DropdownMenuItem(value: 'proj_001', child: Text('山东德州100MW光伏')),
                  DropdownMenuItem(value: 'proj_002', child: Text('内蒙古乌兰察布50MW风电')),
                ].toList(),
              ),
            ),
            SizedBox(height: 24),
            if (_isLoading)
              Center(child: CircularProgressIndicator())
            else if (_report != null)
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildHealthScore(),
                  SizedBox(height: 24),
                  _buildDimensions(),
                  SizedBox(height: 24),
                  _buildFindings(),
                  SizedBox(height: 24),
                  _buildRecommendations(),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildHealthScore() {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Column(
          children: [
            Text('综合健康评分', style: Theme.of(context).textTheme.titleMedium),
            SizedBox(height: 20),
            Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 140,
                  height: 140,
                  child: CustomPaint(
                    painter: _ScoreArcPainter(
                      score: _report!.healthScore,
                      color: _report!.healthColor,
                    ),
                  ),
                ),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _report!.healthScore.toStringAsFixed(0),
                      style: TextStyle(
                        fontSize: 44,
                        fontWeight: FontWeight.bold,
                        color: _report!.healthColor,
                      ),
                    ),
                    Text(
                      '级别 ${_report!.healthGrade}',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF475569),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDimensions() {
    final dimensions = <Map<String, dynamic>>[
      {'label': '逆变器', 'value': 0.85},
      {'label': '组件', 'value': 0.78},
      {'label': '通信', 'value': 0.92},
      {'label': '积灰', 'value': 0.65},
      {'label': '综合PR', 'value': 0.88},
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('维度评估', style: Theme.of(context).textTheme.titleMedium),
        SizedBox(height: 16),
        ...dimensions.map((d) {
          return Padding(
            padding: EdgeInsets.only(bottom: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(d['label'], style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                    Text('${((d['value'] as double) * 100).toStringAsFixed(0)}%',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.primaryColor)),
                  ],
                ),
                SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: (d['value'] as double),
                    minHeight: 6,
                    backgroundColor: Color(0xFFE2E8F0),
                    valueColor: AlwaysStoppedAnimation(AppTheme.primaryColor),
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ],
    );
  }

  Widget _buildFindings() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('诊断发现', style: Theme.of(context).textTheme.titleMedium),
        SizedBox(height: 12),
        ...(_report?.findings ?? []).map((finding) {
          Color severityColor = finding.severity == 'critical'
              ? Color(0xFFEF4444)
              : finding.severity == 'warning'
                  ? Color(0xFFF59E0B)
                  : Color(0xFF3B82F6);

          return Container(
            margin: EdgeInsets.only(bottom: 12),
            padding: EdgeInsets.all(12),
            decoration: BoxDecoration(
              border: Border(left: BorderSide(color: severityColor, width: 4)),
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration:
                          BoxDecoration(color: severityColor.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                      child: Text(
                        finding.category,
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: severityColor),
                      ),
                    ),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        finding.description,
                        style: TextStyle(fontSize: 12, color: Color(0xFF0F172A), fontWeight: FontWeight.w500),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 8),
                Text(
                  '影响：${finding.impact}',
                  style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                ),
              ],
            ),
          );
        }).toList(),
      ],
    );
  }

  Widget _buildRecommendations() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('优化建议', style: Theme.of(context).textTheme.titleMedium),
        SizedBox(height: 12),
        ...(_report?.recommendations ?? []).map((rec) {
          Color priorityColor = rec.priority == 'high'
              ? Color(0xFFEF4444)
              : rec.priority == 'medium'
                  ? Color(0xFFF59E0B)
                  : Color(0xFF3B82F6);

          return Container(
            margin: EdgeInsets.only(bottom: 12),
            padding: EdgeInsets.all(12),
            decoration: BoxDecoration(
              border: Border.all(color: Color(0xFFE2E8F0)),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration:
                          BoxDecoration(color: priorityColor.withOpacity(0.1), borderRadius: BorderRadius.circular(3)),
                      child: Text(
                        rec.priority.toUpperCase(),
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: priorityColor),
                      ),
                    ),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        rec.title,
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 8),
                Text(rec.action, style: TextStyle(fontSize: 12, color: Color(0xFF475569))),
                SizedBox(height: 4),
                Text('预期效益：${rec.expectedBenefit}',
                    style: TextStyle(fontSize: 11, color: Color(0xFF10B981), fontWeight: FontWeight.w500)),
              ],
            ),
          );
        }).toList(),
      ],
    );
  }
}

class _ScoreArcPainter extends CustomPainter {
  final double score;
  final Color color;

  _ScoreArcPainter({required this.score, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;
    final strokeWidth = 8.0;

    final bgPaint = Paint()
      ..color = Color(0xFFE2E8F0)
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -math.pi / 2,
      2 * math.pi,
      false,
      bgPaint,
    );

    final progress = (score / 100).clamp(0.0, 1.0);
    final arcPaint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -math.pi / 2,
      2 * math.pi * progress,
      false,
      arcPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
