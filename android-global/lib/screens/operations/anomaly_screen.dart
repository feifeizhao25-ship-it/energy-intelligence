import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class AnomalyScreen extends StatefulWidget {
  const AnomalyScreen({super.key});
  @override
  State<AnomalyScreen> createState() => _AnomalyScreenState();
}

class _AnomalyScreenState extends State<AnomalyScreen> {
  List<Map<String, dynamic>> _projects = const [];
  List<Map<String, dynamic>> _alerts = const [];
  String? _selectedProject;
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
      final projects = await ApiService.getProjects();
      final alerts = await ApiService.getAlerts();
      if (mounted) {
        setState(() {
          _projects = projects;
          _selectedProject ??= projects.isEmpty
              ? null
              : projects.first['id']?.toString();
          _alerts = alerts
              .where(
                (alert) =>
                    _selectedProject == null ||
                    alert['project_id']?.toString() == _selectedProject,
              )
              .toList();
        });
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => _error =
              'Verified SCADA/IoT anomaly data is not connected. No synthetic alerts are shown.',
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Anomaly Detection')),
    body: RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Operational evidence',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          const Text(
            'Alerts must come from an authorised plant telemetry source.',
            style: TextStyle(color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 16),
          if (_projects.isNotEmpty)
            DropdownButtonFormField<String>(
              initialValue: _selectedProject,
              decoration: const InputDecoration(labelText: 'Project'),
              items: _projects
                  .map(
                    (project) => DropdownMenuItem(
                      value: project['id']?.toString(),
                      child: Text(
                        project['name']?.toString() ?? 'Untitled project',
                      ),
                    ),
                  )
                  .toList(),
              onChanged: (value) {
                setState(() => _selectedProject = value);
                _load();
              },
            ),
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(48),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            _Empty(
              icon: Icons.sensors_off_outlined,
              title: 'Telemetry unavailable',
              detail: _error!,
              retry: _load,
            )
          else if (_alerts.isEmpty)
            const _Empty(
              icon: Icons.check_circle_outline,
              title: 'No verified alerts',
              detail:
                  'No alerts were returned by the connected telemetry provider.',
            )
          else
            ..._alerts.map(
              (alert) => Card(
                child: ListTile(
                  leading: const Icon(
                    Icons.warning_amber_rounded,
                    color: Colors.orange,
                  ),
                  title: Text(
                    alert['title']?.toString() ?? 'Operational alert',
                  ),
                  subtitle: Text(
                    alert['message']?.toString() ??
                        alert['description']?.toString() ??
                        'No description supplied',
                  ),
                  trailing: Text(alert['severity']?.toString() ?? ''),
                ),
              ),
            ),
        ],
      ),
    ),
  );
}

class _Empty extends StatelessWidget {
  final IconData icon;
  final String title;
  final String detail;
  final Future<void> Function()? retry;
  const _Empty({
    required this.icon,
    required this.title,
    required this.detail,
    this.retry,
  });
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Icon(icon, size: 42, color: const Color(0xFF94A3B8)),
          const SizedBox(height: 10),
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(
            detail,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xFF64748B)),
          ),
          if (retry != null)
            TextButton(onPressed: retry, child: const Text('Try again')),
        ],
      ),
    ),
  );
}
