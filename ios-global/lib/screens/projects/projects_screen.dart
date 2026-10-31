import 'package:flutter/material.dart';

import '../../utils/project_display.dart';
import '../../services/api_service.dart';
import 'create_project_screen.dart';

class ProjectsScreen extends StatefulWidget {
  /// Test hook: replaces the network call.
  final Future<List<Map<String, dynamic>>> Function()? loader;
  const ProjectsScreen({super.key, this.loader});
  @override
  State<ProjectsScreen> createState() => _ProjectsScreenState();
}

class _ProjectsScreenState extends State<ProjectsScreen> {
  List<Map<String, dynamic>> _projects = const [];
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final projects = await (widget.loader ?? ApiService.getProjects)();
      if (mounted) setState(() => _projects = projects);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted)
        setState(() => _error = 'Projects are temporarily unavailable.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _create() async {
    final created = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute(builder: (_) => const CreateProjectScreen()),
    );
    if (created != null && mounted) await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Projects'),
        actions: [
          IconButton(
            key: const Key('createProjectButton'),
            tooltip: 'New project',
            icon: const Icon(Icons.add_business_outlined),
            onPressed: _create,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
            ? ListView(
                children: [
                  const SizedBox(height: 180),
                  const Icon(
                    Icons.cloud_off_outlined,
                    size: 48,
                    color: Color(0xFF94A3B8),
                  ),
                  const SizedBox(height: 12),
                  Text(_error!, textAlign: TextAlign.center),
                  TextButton(onPressed: _load, child: const Text('Try again')),
                ],
              )
            : _projects.isEmpty
            ? ListView(
                key: const Key('projectsEmpty'),
                children: [
                  SizedBox(height: 180),
                  Icon(
                    Icons.folder_open_outlined,
                    size: 48,
                    color: Color(0xFF94A3B8),
                  ),
                  SizedBox(height: 12),
                  Text(
                    'No projects yet',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  SizedBox(height: 6),
                  Text(
                    'Tap “New project” to add your first one. The button at the bottom right starts a resource assessment.',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  Center(
                    child: FilledButton.icon(
                      key: const Key('createProjectEmptyCta'),
                      onPressed: _create,
                      icon: const Icon(Icons.add),
                      label: const Text('New project'),
                    ),
                  ),
                ],
              )
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: _projects.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, index) =>
                    _ProjectCard(project: _projects[index]),
              ),
      ),
      floatingActionButton: FloatingActionButton(
        tooltip: 'Resource assessment',
        onPressed: () => Navigator.pushNamed(context, '/resource'),
        child: const Icon(Icons.travel_explore),
      ),
    );
  }
}

class _ProjectCard extends StatelessWidget {
  final Map<String, dynamic> project;
  const _ProjectCard({required this.project});

  @override
  Widget build(BuildContext context) {
    final type = (project['type'] ?? project['technology'] ?? '')
        .toString()
        .toLowerCase();
    final name = (project['name'] ?? 'Untitled project').toString();
    final location =
        projectLocationText(project['location']) ?? 'Location not provided';
    final capacity = projectCapacityText(project);
    final status = (project['status'] ?? 'planning').toString();
    return Semantics(
      button: true,
      label: '$name, $status',
      child: Card(
        margin: EdgeInsets.zero,
        child: ListTile(
          contentPadding: const EdgeInsets.all(16),
          leading: Text(
            type.contains('solar')
                ? '☀️'
                : type.contains('wind')
                ? '💨'
                : '🔋',
            style: const TextStyle(fontSize: 24),
          ),
          title: Text(
            name,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          subtitle: Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(location + (capacity == null ? '' : '\n$capacity')),
          ),
          trailing: Text(
            status,
            style: const TextStyle(fontSize: 12, color: Color(0xFF475569)),
          ),
          onTap: () => Navigator.pushNamed(
            context,
            '/project-detail',
            arguments: project,
          ),
        ),
      ),
    );
  }
}
