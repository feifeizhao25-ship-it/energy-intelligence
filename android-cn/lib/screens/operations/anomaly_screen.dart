import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class AnomalyScreen extends StatefulWidget {
  const AnomalyScreen({super.key});

  @override
  State<AnomalyScreen> createState() => _AnomalyScreenState();
}

class _AnomalyScreenState extends State<AnomalyScreen> {
  bool _isLoading = false;
  String _selectedProject = 'proj_001';
  List<Map<String, dynamic>> _anomalies = [];

  final _projects = [
    {'id': 'proj_001', 'name': '山东德州100MW光伏'},
    {'id': 'proj_002', 'name': '内蒙古50MW风电'},
    {'id': 'proj_003', 'name': '佛山储能项目'},
  ];

  @override
  void initState() {
    super.initState();
    _loadAnomalies();
  }

  Future<void> _loadAnomalies() async {
    setState(() => _isLoading = true);
    await Future.delayed(Duration(milliseconds: 700));

    // Deterministic mock anomalies based on project
    setState(() {
      _anomalies = [
        {
          'id': 'ano_001',
          'type': '发电量偏低',
          'severity': 'high',
          'location': '逆变器 #3 — 组串 A1-A8',
          'actual': 245.6,
          'expected': 312.4,
          'deviation': -21.4,
          'estimatedLoss': 18600.0,
          'time': '2026-03-21 09:30',
          'status': 'active',
        },
        {
          'id': 'ano_002',
          'type': '组件温度过高',
          'severity': 'medium',
          'location': '第3区块 — B区南侧',
          'actual': 78.5,
          'expected': 55.0,
          'deviation': 42.7,
          'estimatedLoss': 4200.0,
          'time': '2026-03-21 11:15',
          'status': 'active',
        },
        {
          'id': 'ano_003',
          'type': 'PR值下降',
          'severity': 'low',
          'location': '全站平均',
          'actual': 0.71,
          'expected': 0.78,
          'deviation': -9.0,
          'estimatedLoss': 8900.0,
          'time': '2026-03-20',
          'status': 'monitoring',
        },
        {
          'id': 'ano_004',
          'type': '通信中断',
          'severity': 'medium',
          'location': '气象站 #2',
          'actual': 0.0,
          'expected': 1.0,
          'deviation': -100.0,
          'estimatedLoss': 0.0,
          'time': '2026-03-21 06:00',
          'status': 'resolved',
        },
      ];
      _isLoading = false;
    });
  }

  Color _severityColor(String severity) {
    switch (severity) {
      case 'high': return Color(0xFFDC2626);
      case 'medium': return Color(0xFFEA580C);
      case 'low': return Color(0xFFCA8A04);
      default: return Color(0xFF64748B);
    }
  }

  String _severityLabel(String severity) {
    switch (severity) {
      case 'high': return '严重';
      case 'medium': return '中等';
      case 'low': return '轻微';
      default: return '未知';
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'active': return Color(0xFFDC2626);
      case 'monitoring': return Color(0xFFCA8A04);
      case 'resolved': return Color(0xFF059669);
      default: return Color(0xFF64748B);
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'active': return '待处理';
      case 'monitoring': return '监测中';
      case 'resolved': return '已解决';
      default: return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final active = _anomalies.where((a) => a['status'] == 'active').length;
    final monitoring = _anomalies.where((a) => a['status'] == 'monitoring').length;

    return Scaffold(
      appBar: AppBar(
        title: Text('发电异常检测'),
        backgroundColor: const Color(0xFF1D4ED8),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: Icon(Icons.refresh),
            onPressed: _loadAnomalies,
          ),
        ],
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Project selector
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
                      onChanged: (v) { setState(() => _selectedProject = v!); _loadAnomalies(); },
                      items: _projects.map((p) => DropdownMenuItem(
                        value: p['id'],
                        child: Text(p['name']!),
                      )).toList(),
                    ),
                  ),
                  SizedBox(height: 16),

                  // Summary cards
                  Row(
                    children: [
                      Expanded(child: _buildSummaryCard('待处理异常', '$active', Color(0xFFDC2626), Icons.warning_rounded)),
                      SizedBox(width: 12),
                      Expanded(child: _buildSummaryCard('监测中', '$monitoring', Color(0xFFCA8A04), Icons.visibility)),
                      SizedBox(width: 12),
                      Expanded(child: _buildSummaryCard('总异常数', '${_anomalies.length}', Color(0xFF1D4ED8), Icons.analytics)),
                    ],
                  ),
                  SizedBox(height: 24),

                  Text('异常详情', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                  SizedBox(height: 12),

                  ..._anomalies.map((anomaly) => _buildAnomalyCard(anomaly)),
                ],
              ),
            ),
    );
  }

  Widget _buildSummaryCard(String label, String value, Color color, IconData icon) {
    return Container(
      padding: EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        border: Border.all(color: color.withOpacity(0.3)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 20),
          SizedBox(height: 6),
          Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
          Text(label, style: TextStyle(fontSize: 10, color: Color(0xFF64748B)), textAlign: TextAlign.center),
        ],
      ),
    );
  }

  Widget _buildAnomalyCard(Map<String, dynamic> anomaly) {
    final sevColor = _severityColor(anomaly['severity'] as String);
    final statusColor = _statusColor(anomaly['status'] as String);

    return Card(
      margin: EdgeInsets.only(bottom: 12),
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: sevColor.withOpacity(0.3), width: 1),
      ),
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(color: sevColor, shape: BoxShape.circle),
                    ),
                    SizedBox(width: 8),
                    Text(anomaly['type'] as String, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                  ],
                ),
                Row(
                  children: [
                    Container(
                      padding: EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: sevColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(_severityLabel(anomaly['severity'] as String), style: TextStyle(fontSize: 11, color: sevColor, fontWeight: FontWeight.bold)),
                    ),
                    SizedBox(width: 8),
                    Container(
                      padding: EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(_statusLabel(anomaly['status'] as String), style: TextStyle(fontSize: 11, color: statusColor, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ],
            ),
            SizedBox(height: 10),
            Row(
              children: [
                Icon(Icons.location_on, size: 14, color: Color(0xFF64748B)),
                SizedBox(width: 4),
                Expanded(child: Text(anomaly['location'] as String, style: TextStyle(fontSize: 13, color: Color(0xFF64748B)))),
              ],
            ),
            SizedBox(height: 8),
            Row(
              children: [
                _buildMetric('实际值', '${anomaly['actual']}'),
                SizedBox(width: 16),
                _buildMetric('期望值', '${anomaly['expected']}'),
                SizedBox(width: 16),
                _buildMetric('偏差', '${anomaly['deviation'].toStringAsFixed(1)}%', color: sevColor),
              ],
            ),
            if ((anomaly['estimatedLoss'] as double) > 0) ...[
              SizedBox(height: 8),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  children: [
                    Icon(Icons.trending_down, size: 14, color: Color(0xFFDC2626)),
                    SizedBox(width: 6),
                    Text('估计损失: ${(anomaly['estimatedLoss'] as double) > 0 ? (anomaly['estimatedLoss'] / 10000).toStringAsFixed(2) + ' 万元' : '-'}', style: TextStyle(fontSize: 12, color: Color(0xFFDC2626))),
                  ],
                ),
              ),
            ],
            SizedBox(height: 8),
            Text(anomaly['time'] as String, style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
          ],
        ),
      ),
    );
  }

  Widget _buildMetric(String label, String value, {Color? color}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
        Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: color ?? Color(0xFF0F172A))),
      ],
    );
  }
}
