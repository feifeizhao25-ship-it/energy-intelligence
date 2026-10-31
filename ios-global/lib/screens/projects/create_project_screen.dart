import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../services/project_wire.dart';

/// Create a project. The server needs a name, type, capacity and coordinates; the plan limits how many projects
/// an account can have (the upgrade message is shown when it is reached).
class CreateProjectScreen extends StatefulWidget {
  /// Test hook: replaces the network call.
  final Future<Map<String, dynamic>> Function(Map<String, dynamic> body)? submit;
  const CreateProjectScreen({super.key, this.submit});

  @override
  State<CreateProjectScreen> createState() => _CreateProjectScreenState();
}

class _CreateProjectScreenState extends State<CreateProjectScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _capacity = TextEditingController();
  final _address = TextEditingController();
  final _lat = TextEditingController();
  final _lng = TextEditingController();
  final _note = TextEditingController();
  String _type = 'solar_pv';
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_name, _capacity, _address, _lat, _lng, _note]) {
      c.dispose();
    }
    super.dispose();
  }

  String? _required(String? v, String what) => (v == null || v.trim().isEmpty) ? 'Enter the $what' : null;

  String? _range(String? v, String what, double min, double max) {
    final n = double.tryParse((v ?? '').trim());
    if (n == null) return 'Enter the $what as a number';
    if (n < min || n > max) return 'The $what must be between $min and $max';
    return null;
  }

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final body = ProjectWire.toWire(
      name: _name.text.trim(),
      technology: _type,
      capacityMw: double.parse(_capacity.text.trim()),
      latitude: double.parse(_lat.text.trim()),
      longitude: double.parse(_lng.text.trim()),
      address: _address.text,
      description: _note.text,
    );
    try {
      final created = widget.submit != null
          ? await widget.submit!(body)
          : ProjectWire.unwrap(await ApiService.createProject(body));
      if (mounted) Navigator.of(context).pop(created);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not create the project right now. Check your connection and try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('New project')),
      body: SafeArea(
        child: Form(
          key: _form,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              TextFormField(
                key: const Key('projectName'),
                controller: _name,
                maxLength: 100,
                decoration: const InputDecoration(labelText: 'Project name', hintText: 'e.g. Texas 20 MW solar'),
                validator: (v) => _required(v, 'project name'),
              ),
              const SizedBox(height: 8),
              const Text('Project type', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  for (final t in const [
                    ['solar_pv', 'Solar PV'],
                    ['wind', 'Wind'],
                    ['storage', 'Storage'],
                    ['hybrid', 'Hybrid'],
                  ])
                    ChoiceChip(
                      key: Key('type_${t[0]}'),
                      label: Text(t[1]),
                      selected: _type == t[0],
                      onSelected: (_) => setState(() => _type = t[0]),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              TextFormField(
                key: const Key('projectCapacity'),
                controller: _capacity,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Capacity (MW)', hintText: 'e.g. 20'),
                validator: (v) {
                  final n = double.tryParse((v ?? '').trim());
                  return (n == null || n <= 0) ? 'Enter a capacity greater than 0' : null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                key: const Key('projectAddress'),
                controller: _address,
                decoration: const InputDecoration(labelText: 'Location (optional)', hintText: 'e.g. Austin, Texas'),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      key: const Key('projectLat'),
                      controller: _lat,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                      decoration: const InputDecoration(labelText: 'Latitude', hintText: '30.27'),
                      validator: (v) => _range(v, 'latitude', -90, 90),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      key: const Key('projectLng'),
                      controller: _lng,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                      decoration: const InputDecoration(labelText: 'Longitude', hintText: '-97.74'),
                      validator: (v) => _range(v, 'longitude', -180, 180),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextFormField(
                key: const Key('projectNote'),
                controller: _note,
                maxLines: 2,
                decoration: const InputDecoration(labelText: 'Notes (optional)'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, key: const Key('createProjectError'), style: const TextStyle(color: Color(0xFFB91C1C))),
              ],
              const SizedBox(height: 20),
              FilledButton(
                key: const Key('createProjectSubmit'),
                onPressed: _busy ? null : _save,
                child: _busy
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Create project'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
