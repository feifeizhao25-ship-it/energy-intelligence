import 'package:flutter/material.dart';

class AnomalyScreen extends StatefulWidget {
  const AnomalyScreen({super.key});

  @override
  State<AnomalyScreen> createState() => _AnomalyScreenState();
}

class _AnomalyScreenState extends State<AnomalyScreen> {
  bool _isLoading = false;
  String _selectedProject = 'proj_001';
  List<Map<String, dynamic>> _anomalies = [];

  final _projects = const [
    {'id': 'proj_001', 'name': 'Mojave 200MW Solar Farm'},
    {'id': 'proj_002', 'name': 'Texas 150MW Wind Farm'},
    {'id': 'proj_003', 'name': 'Nevada 400MWh BESS'},
  ];

  @override
  void initState() {
    super.initState();
    _loadAnomalies();
  }

  Future<void> _loadAnomalies() async {
    setState(() => _isLoading = true);
    await Future.delayed(const Duration(milliseconds: 700));

    setState(() {
      _anomalies = [
        {
          'id': 'ano_001',
          'type': 'Low Generation',
          'severity': 'high',
          'location': 'Inverter #5 — String A3-A12',
          'actual': 318.4,
          'expected': 421.7,
          'deviation': -24.5,
          'estimatedLoss': 4200.0,
          'time': '2026-03-21 09:30',
          'status': 'active',
        },
        {
          'id': 'ano_002',
          'type': 'High Module Temperature',
          'severity': 'medium',
          'location': 'Block 4 — South Section',
          'actual': 82.3,
          'expected': 58.0,
          'deviation': 41.9,
          'estimatedLoss': 980.0,
          'time': '2026-03-21 11:15',
          'status': 'active',
        },
        {
          'id': 'ano_003',
          'type': 'PR Drop',
          'severity': 'low',
          'location': 'Plant Average',
          'actual': 0.73,
          'expected': 0.80,
          'deviation': -8.8,
          'estimatedLoss': 2100.0,
          'time': '2026-03-20',
          'status': 'monitoring',
        },
        {
          'id': 'ano_004',
          'type': 'Communication Loss',
          'severity': 'medium',
          'location': 'Weather Station #1',
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

  Color _severityColor(String s) {
    switch (s) {
      case 'high': return const Color(0xFFDC2626);
      case 'medium': return const Color(0xFFEA580C);
      case 'low': return const Color(0xFFCA8A04);
      default: return const Color(0xFF64748B);
    }
  }

  String _severityLabel(String s) {
    switch (s) {
      case 'high': return 'Critical';
      case 'medium': return 'Warning';
      case 'low': return 'Minor';
      default: return '';
    }
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'active': return const Color(0xFFDC2626);
      case 'monitoring': return const Color(0xFFCA8A04);
      case 'resolved': return const Color(0xFF059669);
      default: return const Color(0xFF64748B);
    }
  }

  String _statusLabel(String s) {
    switch (s) {
      case 'active': return 'Active';
      case 'monitoring': return 'Monitoring';
      case 'resolved': return 'Resolved';
      default: return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final active = _anomalies.where((a) => a['status'] == 'active').length;
    final monitoring = _anomalies.where((a) => a['status'] == 'monitoring').length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Anomaly Detection'),
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E293B),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadAnomalies),
        ],
      ),
      backgroundColor: const Color(0xFFF8FAFC),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Project selector
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: DropdownButton<String>(
                      value: _selectedProject,
                      isExpanded: true,
                      underline: const SizedBox(),
                      onChanged: (v) { setState(() => _selectedProject = v!); _loadAnomalies(); },
                      items: _projects.map((p) => DropdownMenuItem(
                        value: p['id'],
                        child: Text(p['name']!),
                      )).toList(),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Summary
                  Row(
                    children: [
                      Expanded(child: _buildSummaryCard('Active', '$active', const Color(0xFFDC2626), Icons.warning_rounded)),
                      const SizedBox(width: 10),
                      Expanded(child: _buildSummaryCard('Monitoring', '$monitoring', const Color(0xFFCA8A04), Icons.visibility)),
                      const SizedBox(width: 10),
                      Expanded(child: _buildSummaryCard('Total', '${_anomalies.length}', const Color(0xFF1D4ED8), Icons.analytics)),
                    ],
                  ),
                  const SizedBox(height: 20),

                  const Text('Anomaly Details', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                  const SizedBox(height: 12),
                  ..._anomalies.map((a) => _buildAnomalyCard(a)),
                ],
              ),
            ),
    );
  }

  Widget _buildSummaryCard(String label, String value, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: color.withOpacity(0.07),
        border: Border.all(color: color.withOpacity(0.25)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(height: 4),
          Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
          Text(label, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)), textAlign: TextAlign.center),
        ],
      ),
    );
  }

  Widget _buildAnomalyCard(Map<String, dynamic> anomaly) {
    final sevColor = _severityColor(anomaly['severity'] as String);
    final statusColor = _statusColor(anomaly['status'] as String);

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: sevColor.withOpacity(0.25), width: 1),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(children: [
                  Container(width: 8, height: 8, decoration: BoxDecoration(color: sevColor, shape: BoxShape.circle)),
                  const SizedBox(width: 8),
                  Text(anomaly['type'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                ]),
                Row(children: [
                  _buildBadge(_severityLabel(anomaly['severity'] as String), sevColor),
                  const SizedBox(width: 6),
                  _buildBadge(_statusLabel(anomaly['status'] as String), statusColor),
                ]),
              ],
            ),
            const SizedBox(height: 8),
            Row(children: [
              const Icon(Icons.location_on, size: 13, color: Color(0xFF64748B)),
              const SizedBox(width: 4),
              Expanded(child: Text(anomaly['location'] as String, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)))),
            ]),
            const SizedBox(height: 8),
            Row(children: [
              _buildMetric('Actual', '${anomaly['actual']}'),
              const SizedBox(width: 14),
              _buildMetric('Expected', '${anomaly['expected']}'),
              const SizedBox(width: 14),
              _buildMetric('Deviation', '${(anomaly['deviation'] as double).toStringAsFixed(1)}%', color: sevColor),
            ]),
            if ((anomaly['estimatedLoss'] as double) > 0) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(6)),
                child: Row(children: [
                  const Icon(Icons.trending_down, size: 13, color: Color(0xFFDC2626)),
                  const SizedBox(width: 5),
                  Text('Est. loss: \$${((anomaly['estimatedLoss'] as double) / 1000).toStringAsFixed(1)}K/yr', style: const TextStyle(fontSize: 11, color: Color(0xFFDC2626))),
                ]),
              ),
            ],
            const SizedBox(height: 6),
            Text(anomaly['time'] as String, style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
          ],
        ),
      ),
    );
  }

  Widget _buildBadge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
      child: Text(text, style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.bold)),
    );
  }

  Widget _buildMetric(String label, String value, {Color? color}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 9, color: Color(0xFF94A3B8))),
        Text(value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: color ?? const Color(0xFF0F172A))),
      ],
    );
  }
}
