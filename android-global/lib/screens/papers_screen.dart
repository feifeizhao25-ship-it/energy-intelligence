import 'package:flutter/material.dart';

class PapersScreen extends StatelessWidget {
  const PapersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final papers = [
      {'title': 'Perovskite Efficiency 25%', 'year': '2024', 'author': 'Zhang et al.'},
      {'title': 'TOPCon Mass Production 25%', 'year': '2024', 'author': 'Li et al.'},
      {'title': 'HJT Breakthrough 26%', 'year': '2024', 'author': 'Wang et al.'},
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Research Papers')),
      body: ListView.builder(
        itemCount: papers.length,
        itemBuilder: (context, index) {
          final paper = papers[index];
          return ListTile(
            leading: const CircleAvatar(child: Icon(Icons.article)),
            title: Text(paper['title']!),
            subtitle: Text('${paper['year']} - ${paper['author']}'),
            trailing: const Icon(Icons.chevron_right),
          );
        },
      ),
    );
  }
}
