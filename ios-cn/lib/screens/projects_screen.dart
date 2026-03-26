import 'package:flutter/material.dart';
import '../services/api_service.dart';

class ProjectsScreen extends StatefulWidget {
  const ProjectsScreen({super.key});

  @override
  State<ProjectsScreen> createState() => _ProjectsScreenState();
}

class _ProjectsScreenState extends State<ProjectsScreen> {
  List<dynamic> _projects = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final projects = await ApiService.getProjects();
    setState(() {
      _projects = projects;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('项目管理'),
        backgroundColor: Colors.blue[700],
        actions: [
          IconButton(icon: const Icon(Icons.add), onPressed: () {}),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _projects.length,
                itemBuilder: (context, index) {
                  return _buildProjectCard(_projects[index]);
                },
              ),
            ),
    );
  }

  Widget _buildProjectCard(Map<String, dynamic> project) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: InkWell(
        onTap: () {},
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    backgroundColor: project['type'] == 'pv' ? Colors.orange[100] : (project['type'] == 'wind' ? Colors.blue[100] : Colors.green[100]),
                    child: Text(project['type'] == 'pv' ? '☀️' : (project['type'] == 'wind' ? '🌀' : '🔋')),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(project['name'], style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        Text('${project['type'] == 'pv' ? '光伏' : (project['type'] == 'wind' ? '风电' : '储能')} | ${project['capacity']}MW'),
                      ],
                    ),
                  ),
                  Chip(
                    label: Text(project['status']),
                    backgroundColor: project['status'] == '运行中' ? Colors.green[100] : Colors.orange[100],
                  ),
                ],
              ),
              const Divider(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildStat('IRR', '${project['irr']}%', Colors.green),
                  _buildStat('健康', '${project['healthScore']}%', Colors.blue),
                  _buildStat('容量', '${project['capacity']}MW', Colors.purple),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStat(String label, String value, Color color) {
    return Column(
      children: [
        Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
        Text(label, style: TextStyle(color: Colors.grey[600])),
      ],
    );
  }
}
