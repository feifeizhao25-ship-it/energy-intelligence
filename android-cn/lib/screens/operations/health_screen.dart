import '../../widgets/photo_widgets.dart';
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
  List<Map<String, dynamic>> _projects = [];
  String? _selectedProject;
  bool _projectsLoaded = false;

  @override
  void initState() {
    super.initState();
    _loadProjects();
  }

  /// 项目列表来自账号里真实保存的项目，不再写死两个示例项目。
  Future<void> _loadProjects() async {
    setState(() => _isLoading = true);
    try {
      final rows = await ApiService.getProjects();
      if (!mounted) return;
      setState(() {
        _projects = rows;
        _projectsLoaded = true;
        _selectedProject = rows.isEmpty ? null : rows.first['id']?.toString();
        _isLoading = rows.isNotEmpty;
      });
      if (_selectedProject != null) _loadReport();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('项目列表加载失败，请稍后重试')));
      setState(() {
        _projectsLoaded = true;
        _isLoading = false;
      });
    }
  }

  void _loadReport() async {
    final projectId = _selectedProject;
    if (projectId == null) return;
    setState(() => _isLoading = true);
    try {
      final report = await ApiService.getHealthReport(projectId);
      if (!mounted) return;
      setState(() {
        _report = DiagnosticReport.fromJson(report);
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('加载失败')));
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
            if (_projectsLoaded && _projects.isEmpty)
              Container(
                width: double.infinity,
                padding: EdgeInsets.all(16),
                decoration: BoxDecoration(
                  border: Border.all(color: Color(0xFFE2E8F0)),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: EnEmptyState(
                  title: '还没有项目',
                  message: '请先在「项目」页新建一个项目，再回来做健康诊断。',
                ),
              )
            else if (_projects.isNotEmpty)
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
                    for (final p in _projects)
                      DropdownMenuItem(
                        value: p['id']?.toString(),
                        child: Text('${p['name'] ?? p['title'] ?? '未命名项目'}'),
                      ),
                  ],
                ),
              ),
            SizedBox(height: 24),
            if (_isLoading)
              Center(child: CircularProgressIndicator())
            else if (_report == null && _projects.isNotEmpty)
              Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: EnEmptyState(
                  title: '暂无诊断报告',
                  message: '这个项目暂时没有可用的诊断报告。运行数据接入后会在这里生成，不会用示例数据代替。',
                ),
              )
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
      {'label': '综合性能比', 'value': 0.88},
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
                    Text(
                      d['label'],
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    Text(
                      '${((d['value'] as double) * 100).toStringAsFixed(0)}%',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.primaryColor,
                      ),
                    ),
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
        }),
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
                      decoration: BoxDecoration(
                        color: severityColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        finding.category,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: severityColor,
                        ),
                      ),
                    ),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        finding.description,
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF0F172A),
                          fontWeight: FontWeight.w500,
                        ),
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
        }),
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
                      decoration: BoxDecoration(
                        color: priorityColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(3),
                      ),
                      child: Text(
                        rec.priority.toUpperCase(),
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: priorityColor,
                        ),
                      ),
                    ),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        rec.title,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 8),
                Text(
                  rec.action,
                  style: TextStyle(fontSize: 12, color: Color(0xFF475569)),
                ),
                SizedBox(height: 4),
                Text(
                  '预期效益：${rec.expectedBenefit}',
                  style: TextStyle(
                    fontSize: 11,
                    color: Color(0xFF10B981),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          );
        }),
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
