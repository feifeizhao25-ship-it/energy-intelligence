import 'package:flutter/material.dart';

class ProjectsScreen extends StatelessWidget {
  const ProjectsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final projects = [
      {'name': 'Solar Farm Texas', 'type': 'Solar', 'capacity': '100 MW', 'status': 'Operating'},
      {'name': 'Wind Park California', 'type': 'Wind', 'capacity': '50 MW', 'status': 'Operating'},
      {'name': 'Storage Station NY', 'type': 'Storage', 'capacity': '25 MWh', 'status': 'Planning'},
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Projects')),
      body: ListView.builder(
        itemCount: projects.length,
        itemBuilder: (context, index) {
          final project = projects[index];
          return ListTile(
            leading: CircleAvatar(
              child: Icon(
                project['type'] == 'Solar' ? Icons.solar_power :
                project['type'] == 'Wind' ? Icons.air : Icons.battery_charging_full,
              ),
            ),
            title: Text(project['name']!),
            subtitle: Text('${project['capacity']} - ${project['status']}'),
            trailing: const Icon(Icons.chevron_right),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {},
        child: const Icon(Icons.add),
      ),
    );
  }
}
