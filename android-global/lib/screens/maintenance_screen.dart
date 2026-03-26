import 'package:flutter/material.dart';

class MaintenanceScreen extends StatelessWidget {
  const MaintenanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final issues = [
      {'plant': 'Solar Farm TX', 'issue': 'Inverter E001', 'status': 'Open', 'priority': 'High'},
      {'plant': 'Wind Park CA', 'issue': 'Blade inspection', 'status': 'Scheduled', 'priority': 'Medium'},
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Maintenance')),
      body: ListView.builder(
        itemCount: issues.length,
        itemBuilder: (context, index) {
          final issue = issues[index];
          return ListTile(
            leading: CircleAvatar(
              backgroundColor: issue['priority'] == 'High' ? Colors.red : Colors.orange,
              child: const Icon(Icons.build, color: Colors.white),
            ),
            title: Text(issue['plant']!),
            subtitle: Text(issue['issue']!),
            trailing: Chip(label: Text(issue['status']!)),
          );
        },
      ),
    );
  }
}
