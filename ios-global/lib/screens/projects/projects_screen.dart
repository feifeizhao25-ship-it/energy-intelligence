import 'package:flutter/material.dart';
import '../../models/project.dart';
import '../../services/api_service.dart';
import '../../widgets/project_card.dart';
import 'project_detail_screen.dart';

class ProjectsScreen extends StatefulWidget {
  const ProjectsScreen({super.key});

  @override
  State<ProjectsScreen> createState() => _ProjectsScreenState();
}

class _ProjectsScreenState extends State<ProjectsScreen> {
  late Future<List<Project>> _projectsFuture;
  String _filterType = '全部';
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _projectsFuture = ApiService.getProjects().then(
      (maps) => maps.map((m) => Project.fromJson(m)).toList(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('项目管理')),
      body: FutureBuilder<List<Project>>(
        future: _projectsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return Center(child: CircularProgressIndicator());
          }

          final projects = snapshot.data ?? [];
          final filtered = projects.where((p) {
            bool typeMatch = _filterType == '全部' || p.projectType == _filterType;
            bool searchMatch = p.name.toLowerCase().contains(_searchQuery.toLowerCase());
            return typeMatch && searchMatch;
          }).toList();

          return Column(
            children: [
              Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  children: [
                    TextField(
                      decoration: InputDecoration(
                        hintText: '搜索项目...',
                        prefixIcon: Icon(Icons.search),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onChanged: (value) => setState(() => _searchQuery = value),
                    ),
                    SizedBox(height: 12),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          _buildFilterChip('全部'),
                          _buildFilterChip('solar_pv', label: '光伏'),
                          _buildFilterChip('wind', label: '风电'),
                          _buildFilterChip('storage', label: '储能'),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: filtered.isEmpty
                    ? Center(child: Text('没有找到匹配的项目'))
                    : ListView.builder(
                        padding: EdgeInsets.all(16),
                        itemCount: filtered.length,
                        itemBuilder: (context, index) {
                          final project = filtered[index];
                          return Padding(
                            padding: EdgeInsets.only(bottom: 12),
                            child: ProjectCard(
                              project: project,
                              onTap: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => ProjectDetailScreen(project: project.toJson()),
                                  ),
                                );
                              },
                            ),
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showCreateProjectDialog(),
        child: Icon(Icons.add),
      ),
    );
  }

  Widget _buildFilterChip(String value, {String? label}) {
    bool isActive = _filterType == value;
    return Padding(
      padding: EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label ?? value),
        selected: isActive,
        onSelected: (_) => setState(() => _filterType = value),
      ),
    );
  }

  void _showCreateProjectDialog() {
    final nameController = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('新建项目'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: InputDecoration(labelText: '项目名称'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: Text('取消')),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('项目已创建')));
            },
            child: Text('创建'),
          ),
        ],
      ),
    );
  }
}
