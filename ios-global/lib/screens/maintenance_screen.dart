import 'package:flutter/material.dart';
import '../services/api_service.dart';

class MaintenanceScreen extends StatefulWidget {
  const MaintenanceScreen({super.key});

  @override
  State<MaintenanceScreen> createState() => _MaintenanceScreenState();
}

class _MaintenanceScreenState extends State<MaintenanceScreen> {
  List<dynamic> _healthData = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final data = await ApiService.getHealthData('proj_001');
    setState(() {
      _healthData = (data is List ? data as List : [data]).toList();
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('运维中心'), backgroundColor: Colors.blue[700]),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _healthData.length,
                itemBuilder: (context, index) {
                  final item = _healthData[index];
                  return _buildHealthCard(item);
                },
              ),
            ),
    );
  }

  Widget _buildHealthCard(Map<String, dynamic> item) {
    final score = item['score'] as int;
    final status = item['status'] as String;
    final issues = item['issues'] as List;
    
    Color scoreColor = Colors.green;
    if (score < 90) scoreColor = Colors.orange;
    if (score < 70) scoreColor = Colors.red;
    
    String statusText = '优秀';
    if (status == 'good') statusText = '良好';
    if (status == 'fair') statusText = '一般';
    
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(item['projectName'], style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(color: scoreColor.withAlpha(51), borderRadius: BorderRadius.circular(20)),
                  child: Row(
                    children: [
                      Icon(Icons.health_and_safety, color: scoreColor, size: 20),
                      const SizedBox(width: 4),
                      Text('$score分', style: TextStyle(color: scoreColor, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Chip(label: Text('状态: $statusText')),
            if (issues.isNotEmpty) ...[
              const SizedBox(height: 12),
              const Text('问题:', style: TextStyle(fontWeight: FontWeight.bold)),
              ...issues.map<Widget>((issue) {
                final issueMap = issue as Map<String, dynamic>;
                return Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Row(
                    children: [
                      const Icon(Icons.warning, color: Colors.orange, size: 16),
                      const SizedBox(width: 8),
                      Expanded(child: Text('${issueMap['component']}: ${issueMap['issue']}')),
                    ],
                  ),
                );
              }).toList(),
            ],
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('下次检查: 2026-04-${10 + score % 20}', style: TextStyle(color: Colors.grey[600])),
                ElevatedButton(onPressed: () {}, child: const Text('详细诊断')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
