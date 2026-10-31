import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../services/project_wire.dart';

/// 新建项目。服务端要求：名称、类型、容量、经纬度；套餐项目数有上限（超出时显示升级提示）。
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

  String? _required(String? v, String what) => (v == null || v.trim().isEmpty) ? '请填写$what' : null;

  String? _range(String? v, String what, double min, double max) {
    final n = double.tryParse((v ?? '').trim());
    if (n == null) return '请填写$what（数字）';
    if (n < min || n > max) return '$what需在 $min 到 $max 之间';
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
      if (mounted) setState(() => _error = '暂时无法创建项目，请检查网络后重试。');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('新建项目')),
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
                decoration: const InputDecoration(labelText: '项目名称', hintText: '例如：江苏盐城 20MW 光伏'),
                validator: (v) => _required(v, '项目名称'),
              ),
              const SizedBox(height: 8),
              const Text('项目类型', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  for (final t in const [
                    ['solar_pv', '光伏'],
                    ['wind', '风电'],
                    ['storage', '储能'],
                    ['hybrid', '混合'],
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
                decoration: const InputDecoration(labelText: '装机容量（MW）', hintText: '例如：20'),
                validator: (v) {
                  final n = double.tryParse((v ?? '').trim());
                  return (n == null || n <= 0) ? '请填写大于 0 的装机容量' : null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                key: const Key('projectAddress'),
                controller: _address,
                decoration: const InputDecoration(labelText: '地点（选填）', hintText: '例如：江苏省盐城市'),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      key: const Key('projectLat'),
                      controller: _lat,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                      decoration: const InputDecoration(labelText: '纬度', hintText: '33.35'),
                      validator: (v) => _range(v, '纬度', -90, 90),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      key: const Key('projectLng'),
                      controller: _lng,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                      decoration: const InputDecoration(labelText: '经度', hintText: '120.16'),
                      validator: (v) => _range(v, '经度', -180, 180),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextFormField(
                key: const Key('projectNote'),
                controller: _note,
                maxLines: 2,
                decoration: const InputDecoration(labelText: '备注（选填）'),
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
                    : const Text('创建项目'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
