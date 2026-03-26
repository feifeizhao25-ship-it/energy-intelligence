import 'package:flutter/material.dart';

class ReportsScreen extends StatelessWidget {
  const ReportsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final reports = [
      {'title': '2026年第一季度运营报告', 'type': '运营', 'date': '2026-03-01', 'size': '2.3MB'},
      {'title': '光伏项目可行性分析报告', 'type': '投资', 'date': '2026-02-15', 'size': '1.8MB'},
      {'title': '电站健康诊断报告', 'type': '诊断', 'date': '2026-02-01', 'size': '3.1MB'},
      {'title': '年度收益预测报告', 'type': '财务', 'date': '2026-01-20', 'size': '1.5MB'},
      {'title': '张家口风电场月度报告', 'type': '月度', 'date': '2026-01-31', 'size': '2.0MB'},
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('报告中心'), backgroundColor: Colors.blue[700]),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: ElevatedButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.add),
              label: const Text('生成新报告'),
              style: ElevatedButton.styleFrom(backgroundColor: Colors.blue[700], foregroundColor: Colors.white, minimumSize: const Size.fromHeight(48)),
            ),
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: reports.length,
              itemBuilder: (context, index) {
                final report = reports[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: Colors.blue[100],
                      child: const Icon(Icons.description, color: Colors.blue),
                    ),
                    title: Text(report['title']!),
                    subtitle: Text('${report['type']} | ${report['date']} | ${report['size']}'),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(icon: const Icon(Icons.visibility), onPressed: () {}),
                        IconButton(icon: const Icon(Icons.download), onPressed: () {}),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
