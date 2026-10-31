import 'package:flutter/material.dart';
import '../../models/project.dart';
import '../../services/api_service.dart';
import '../../widgets/project_card.dart';
import 'create_project_screen.dart';
import 'project_detail_screen.dart';

class ProjectsScreen extends StatefulWidget {
  /// Test hook: replaces the network call.
  final Future<List<Map<String, dynamic>>> Function()? loader;
  const ProjectsScreen({super.key, this.loader});

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
    _projectsFuture = (widget.loader ?? ApiService.getProjects)().then(
      (maps) => maps.map((m) => Project.fromJson(m)).toList(),
    );
  }

  Future<void> _create() async {
    final created = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute(builder: (_) => const CreateProjectScreen()),
    );
    if (created != null && mounted) {
      setState(() {
        _projectsFuture = (widget.loader ?? ApiService.getProjects)().then(
          (maps) => maps.map((m) => Project.fromJson(m)).toList(),
        );
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('项目管理'),
        actions: [
          IconButton(
            key: Key('createProjectButton'),
            tooltip: '新建项目',
            icon: Icon(Icons.add_business_outlined),
            onPressed: _create,
          ),
        ],
      ),
      body: FutureBuilder<List<Project>>(
        future: _projectsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.cloud_off_outlined, size: 48, color: Colors.grey),
                  SizedBox(height: 12),
                  Text('项目数据暂时不可用'),
                  TextButton(
                    onPressed: () => setState(() {
                      _projectsFuture = (widget.loader ?? ApiService.getProjects)().then(
                        (maps) => maps.map((m) => Project.fromJson(m)).toList(),
                      );
                    }),
                    child: Text('重试'),
                  ),
                ],
              ),
            );
          }

          final projects = snapshot.data ?? [];
          final filtered = projects.where((p) {
            bool typeMatch =
                _filterType == '全部' || p.projectType == _filterType;
            bool searchMatch = p.name.toLowerCase().contains(
              _searchQuery.toLowerCase(),
            );
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
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      onChanged: (value) =>
                          setState(() => _searchQuery = value),
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
                    ? (projects.isEmpty
                          ? Center(
                              key: Key('projectsEmpty'),
                              child: Padding(
                                padding: EdgeInsets.symmetric(horizontal: 32),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(16),
                                      child: Image.asset('assets/images/en_empty_substation.webp', height: 150, fit: BoxFit.cover,
                                          errorBuilder: (_, __, ___) => SizedBox(height: 150)),
                                    ),
                                    SizedBox(height: 14),
                                    Text(
                                      '还没有项目',
                                      style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    SizedBox(height: 6),
                                    Text(
                                      '点击下方“新建项目”创建第一个项目；右下角的按钮可直接做资源评估。',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: Color(0xFF64748B),
                                        height: 1.5,
                                      ),
                                    ),
                                    SizedBox(height: 16),
                                    FilledButton.icon(
                                      key: Key('createProjectEmptyCta'),
                                      onPressed: _create,
                                      icon: Icon(Icons.add),
                                      label: Text('新建项目'),
                                    ),
                                  ],
                                ),
                              ),
                            )
                          : Center(child: Text('没有找到匹配的项目')))
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
                                    builder: (_) =>
                                        ProjectDetailScreen(project: project),
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
        tooltip: '资源评估',
        onPressed: () => Navigator.pushNamed(context, '/resource'),
        child: Icon(Icons.travel_explore),
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
}
