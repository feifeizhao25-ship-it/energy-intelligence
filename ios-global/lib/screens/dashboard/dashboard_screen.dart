import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
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
      final projects = await ApiService.getProjects();
      if (mounted) setState(() => _projects = projects);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted)
        setState(() => _error = 'Dashboard data is temporarily unavailable.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  double get _capacity => _projects.fold(0, (sum, project) {
    final value =
        project['capacity_mw'] ?? project['capacityMw'] ?? project['capacity'];
    return sum + (value is num ? value.toDouble() : 0);
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.bolt, color: AppTheme.primary),
            SizedBox(width: 8),
            Text('Energy Intelligence'),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text(
              'Portfolio overview',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 6),
            const Text(
              'Only verified account and project data are shown.',
              style: TextStyle(color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 20),
            if (_loading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(48),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (_error != null)
              _StatusCard(
                icon: Icons.cloud_off_outlined,
                title: 'Data unavailable',
                detail: _error!,
                action: _load,
              )
            else ...[
              Row(
                children: [
                  Expanded(
                    child: _Metric(
                      title: 'Projects',
                      value: _projects.length.toString(),
                      icon: Icons.folder_outlined,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _Metric(
                      title: 'Capacity',
                      value: _capacity == 0
                          ? 'Not provided'
                          : _capacity.toStringAsFixed(1) + ' MW',
                      icon: Icons.bolt,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const _StatusCard(
                icon: Icons.monitor_heart_outlined,
                title: 'Operations metrics',
                detail:
                    'Connect verified telemetry to display generation, revenue, carbon impact, health and alerts.',
              ),
            ],
            const SizedBox(height: 28),
            const Text(
              'Quick actions',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                _Action(
                  icon: Icons.folder_outlined,
                  label: 'Projects',
                  route: '/projects',
                ),
                _Action(
                  icon: Icons.location_on_outlined,
                  label: 'Assess site',
                  route: '/resource',
                ),
                _Action(
                  icon: Icons.calculate_outlined,
                  label: 'Finance',
                  route: '/finance',
                ),
                _Action(
                  icon: Icons.auto_awesome_outlined,
                  label: 'AI assistant',
                  route: '/ai',
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  const _Metric({required this.title, required this.value, required this.icon});
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: AppTheme.primary),
          const SizedBox(height: 16),
          Text(
            value,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
          ),
          Text(title, style: const TextStyle(color: Color(0xFF64748B))),
        ],
      ),
    ),
  );
}

class _StatusCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String detail;
  final Future<void> Function()? action;
  const _StatusCard({
    required this.icon,
    required this.title,
    required this.detail,
    this.action,
  });
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: const Color(0xFF64748B)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text(detail, style: const TextStyle(color: Color(0xFF64748B))),
                if (action != null)
                  TextButton(onPressed: action, child: const Text('Try again')),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class _Action extends StatelessWidget {
  final IconData icon;
  final String label;
  final String route;
  const _Action({required this.icon, required this.label, required this.route});
  @override
  Widget build(BuildContext context) => ActionChip(
    avatar: Icon(icon, size: 18),
    label: Text(label),
    onPressed: () => Navigator.pushNamed(context, route),
  );
}
