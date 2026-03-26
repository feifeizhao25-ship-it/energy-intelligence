import 'package:flutter/material.dart';
import '../services/api_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Map<String, dynamic> _metrics = {};
  List<Map<String, dynamic>> _projects = [];
  List<Map<String, dynamic>> _alerts = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final metrics = await ApiService.getMetrics();
    final projects = await ApiService.getProjects();
    final alerts = await ApiService.getAlerts();
    // Transform dashboard metrics Map → list of metric cards
    final metricCards = [
      {'label': '项目总数', 'value': '${metrics['total_projects'] ?? 0}', 'trend': 'up', 'change': '0'},
      {'label': '总装机容量', 'value': '${metrics['total_capacity_mw'] ?? 0.0}MW', 'trend': 'up', 'change': '0'},
      {'label': '平均IRR', 'value': '${((metrics['total_irr'] ?? 0.0) as num).toStringAsFixed(1)}%', 'trend': 'up', 'change': '0'},
      {'label': '活跃告警', 'value': '${metrics['alerts_count'] ?? 0}', 'trend': 'down', 'change': '0'},
    ];
    setState(() {
      _metrics = {'cards': metricCards};
      _projects = List<Map<String, dynamic>>.from(projects);
      _alerts = List<Map<String, dynamic>>.from(alerts);
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('新能源智库'),
        centerTitle: true,
        backgroundColor: Colors.blue[700],
        actions: [
          IconButton(icon: const Icon(Icons.notifications), onPressed: () {}),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // 指标卡片
                    _buildMetricsGrid(),
                    const SizedBox(height: 24),
                    
                    // 告警
                    if (_alerts.isNotEmpty) ...[
                      _buildAlerts(),
                      const SizedBox(height: 24),
                    ],
                    
                    // 项目列表
                    _buildProjects(),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildMetricsGrid() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('今日概览', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.5,
          children: (_metrics['cards'] as List? ?? []).map((m) => _buildMetricCard(m as Map<String, dynamic>)).toList(),
        ),
      ],
    );
  }

  Widget _buildMetricCard(Map<String, dynamic> metric) {
    final isUp = metric['trend'] == 'up';
    final isDown = metric['trend'] == 'down';
    Color changeColor = Colors.grey;
    if (isUp) changeColor = Colors.green;
    if (isDown) changeColor = Colors.red;

    return Card(
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(metric['label'], style: TextStyle(color: Colors.grey[600], fontSize: 12)),
            Text(metric['value'], style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            Row(
              children: [
                Icon(isUp ? Icons.arrow_upward : (isDown ? Icons.arrow_downward : Icons.remove), 
                     size: 14, color: changeColor),
                Text('${metric['change']}%', style: TextStyle(color: changeColor, fontSize: 12)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAlerts() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('告警提醒', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        ..._alerts.map((a) => Card(
          color: a['type'] == 'error' ? Colors.red[50] : (a['type'] == 'warning' ? Colors.orange[50] : Colors.blue[50]),
          child: ListTile(
            leading: Icon(
              a['type'] == 'error' ? Icons.error : (a['type'] == 'warning' ? Icons.warning : Icons.info),
              color: a['type'] == 'error' ? Colors.red : (a['type'] == 'warning' ? Colors.orange : Colors.blue),
            ),
            title: Text(a['message']),
            subtitle: Text(a['time']),
          ),
        )),
      ],
    );
  }

  Widget _buildProjects() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('我的项目', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        ..._projects.map((p) => Card(
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: p['type'] == 'pv' ? Colors.orange[100] : (p['type'] == 'wind' ? Colors.blue[100] : Colors.green[100]),
              child: Text(p['type'] == 'pv' ? '☀️' : (p['type'] == 'wind' ? '🌀' : '🔋')),
            ),
            title: Text(p['name']),
            subtitle: Text('${p['status']} | ${p['capacity']}MW | IRR: ${p['irr']}%'),
            trailing: Chip(
              label: Text('健康 ${p['healthScore']}%'),
              backgroundColor: p['healthScore'] > 90 ? Colors.green[100] : Colors.orange[100],
            ),
          ),
        )),
      ],
    );
  }
}
