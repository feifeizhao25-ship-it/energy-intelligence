import 'package:flutter/material.dart';

import 'report_sources_screen.dart';

/// Real project details. The project comes from the Projects list (route arguments or constructor);
/// nothing here is a placeholder: fields the server did not send are simply not shown.
class ProjectDetailScreen extends StatelessWidget {
  final Map<String, dynamic>? project;
  const ProjectDetailScreen({super.key, this.project});

  static const _techNames = {'solar': 'Solar PV', 'solar_pv': 'Solar PV', 'wind': 'Wind', 'hybrid': 'Hybrid', 'storage': 'Storage'};

  Map<String, dynamic>? _resolve(BuildContext context) {
    if (project != null) return project;
    final args = ModalRoute.of(context)?.settings.arguments;
    return args is Map ? Map<String, dynamic>.from(args) : null;
  }

  String? _text(Map<String, dynamic> p, String key) {
    final v = p[key];
    if (v == null) return null;
    final s = v.toString().trim();
    return s.isEmpty ? null : s;
  }

  @override
  Widget build(BuildContext context) {
    final p = _resolve(context);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Project Details'), elevation: 0),
      body: p == null || _text(p, 'id') == null
          ? Center(
              key: const Key('projectDetailEmpty'),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'Pick a project from the Projects list to see its details.',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium,
                ),
              ),
            )
          : _content(context, p),
    );
  }

  Widget _content(BuildContext context, Map<String, dynamic> p) {
    final theme = Theme.of(context);
    final name = _text(p, 'name') ?? 'Untitled project';
    final location = _text(p, 'location');
    final tech = _text(p, 'technology');
    final capacity = _text(p, 'capacity_mw') ?? _text(p, 'capacityMw');
    final status = _text(p, 'status');
    final rows = <MapEntry<String, String>>[
      if (tech != null) MapEntry('Technology', _techNames[tech.toLowerCase()] ?? tech),
      if (capacity != null) MapEntry('Capacity', '$capacity MW'),
      if (location != null) MapEntry('Location', location),
      if (status != null) MapEntry('Status', status[0].toUpperCase() + status.substring(1)),
    ];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(name, style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
        if (location != null) ...[
          const SizedBox(height: 4),
          Text(location, style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.outline)),
        ],
        const SizedBox(height: 20),
        if (rows.isNotEmpty) ...[
          Text('Key information', style: theme.textTheme.titleSmall),
          const SizedBox(height: 8),
          for (final r in rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text(r.key, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline)),
                Flexible(child: Text(r.value, textAlign: TextAlign.end, style: theme.textTheme.bodyMedium)),
              ]),
            ),
          const SizedBox(height: 16),
        ],
        Text('Actions', style: theme.textTheme.titleSmall),
        const SizedBox(height: 8),
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: theme.dividerColor),
          ),
          child: Column(children: [
            ListTile(
              key: const Key('openFinance'),
              leading: const Icon(Icons.calculate_outlined),
              title: const Text('Financial model'),
              subtitle: const Text('Model returns with your own assumptions'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.pushNamed(context, '/finance'),
            ),
            const Divider(height: 1),
            ListTile(
              key: const Key('openReportSources'),
              leading: const Icon(Icons.fact_check_outlined),
              title: const Text('Report data sources'),
              subtitle: const Text('Register the sources your reports cite'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => ReportSourcesScreen(projectId: _text(p, 'id')!, projectName: name),
              )),
            ),
          ]),
        ),
      ],
    );
  }
}
