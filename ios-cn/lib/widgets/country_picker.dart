import 'package:flutter/material.dart';

import '../services/api_service.dart';

/// Project country (B16): ISO 3166-1 alpha-2 code the server stores on the project. Reports use it for the grid
/// standard, currency and wording, so the user can set it on create and correct it later. Leaving it empty means
/// "recognise it from the location" (the server never defaults it).

const List<List<String>> kCountryOptions = [
  ['CN', '中国'],
  ['US', '美国'],
  ['IN', '印度'],
  ['GB', '英国'],
  ['DE', '德国'],
  ['FR', '法国'],
  ['ES', '西班牙'],
  ['IT', '意大利'],
  ['NL', '荷兰'],
  ['PL', '波兰'],
  ['TR', '土耳其'],
  ['AU', '澳大利亚'],
  ['NZ', '新西兰'],
  ['CA', '加拿大'],
  ['MX', '墨西哥'],
  ['BR', '巴西'],
  ['CL', '智利'],
  ['AR', '阿根廷'],
  ['ZA', '南非'],
  ['EG', '埃及'],
  ['KE', '肯尼亚'],
  ['NG', '尼日利亚'],
  ['MA', '摩洛哥'],
  ['AE', '阿联酋'],
  ['SA', '沙特阿拉伯'],
  ['JP', '日本'],
  ['KR', '韩国'],
  ['SG', '新加坡'],
  ['TH', '泰国'],
  ['VN', '越南'],
  ['ID', '印度尼西亚'],
  ['PH', '菲律宾'],
  ['PK', '巴基斯坦'],
  ['BD', '孟加拉国'],
];

String? countryName(String? code) {
  if (code == null || code.isEmpty) return null;
  for (final c in kCountryOptions) {
    if (c[0] == code.toUpperCase()) return c[1];
  }
  return code.toUpperCase();
}

String get _auto => '按地点自动识别';
String get _label => '国家 / 地区（选填）';
String get _title => '选择国家或地区';

/// Opens the picker; returns `(chosen: true, code)` so "detect from location" (null) is distinguishable from a dismissal.
Future<({bool chosen, String? code})> pickCountry(BuildContext context, String? current) async {
  final res = await showModalBottomSheet<List<String?>>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => SafeArea(
      child: SizedBox(
        height: MediaQuery.of(ctx).size.height * 0.7,
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(_title, style: Theme.of(ctx).textTheme.titleMedium),
          ),
          Expanded(
            child: ListView(children: [
              ListTile(
                key: const Key('country_auto'),
                title: Text(_auto),
                trailing: current == null ? const Icon(Icons.check) : null,
                onTap: () => Navigator.pop(ctx, <String?>[null]),
              ),
              for (final c in kCountryOptions)
                ListTile(
                  key: Key('country_${c[0]}'),
                  title: Text(c[1]),
                  subtitle: Text(c[0]),
                  trailing: current?.toUpperCase() == c[0] ? const Icon(Icons.check) : null,
                  onTap: () => Navigator.pop(ctx, <String?>[c[0]]),
                ),
            ]),
          ),
        ]),
      ),
    ),
  );
  if (res == null) return (chosen: false, code: null);
  return (chosen: true, code: res.first);
}

/// Form field for the create screen.
class CountryField extends StatelessWidget {
  final String? value;
  final ValueChanged<String?> onChanged;
  const CountryField({super.key, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      key: const Key('countryField'),
      onTap: () async {
        final r = await pickCountry(context, value);
        if (r.chosen) onChanged(r.code);
      },
      child: InputDecorator(
        decoration: InputDecoration(labelText: _label, suffixIcon: const Icon(Icons.arrow_drop_down)),
        child: Text(countryName(value) ?? _auto),
      ),
    );
  }
}

/// Row for the project detail screen: shows the country and lets the user correct it (PUT /projects/{id}/country).
class ProjectCountryRow extends StatefulWidget {
  final String projectId;
  final String? initial;
  /// Test hook: replaces the network call.
  final Future<Map<String, dynamic>> Function(String projectId, String? code)? update;
  const ProjectCountryRow({super.key, required this.projectId, this.initial, this.update});

  @override
  State<ProjectCountryRow> createState() => _ProjectCountryRowState();
}

class _ProjectCountryRowState extends State<ProjectCountryRow> {
  String? _code;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _code = widget.initial;
  }

  Future<void> _edit() async {
    final r = await pickCountry(context, _code);
    if (!r.chosen || !mounted) return;
    setState(() => _busy = true);
    try {
      final update = widget.update ?? ApiService.updateProjectCountry;
      final resp = await update(widget.projectId, r.code);
      final data = resp['data'] is Map ? resp['data'] as Map : resp;
      if (mounted) setState(() => _code = data['country_code']?.toString());
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('保存失败，请稍后重试'),
        ));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text('国家 / 地区', style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline)),
        Row(mainAxisSize: MainAxisSize.min, children: [
          Text(countryName(_code) ?? '未设置', key: const Key('projectCountryValue')),
          IconButton(
            key: const Key('editCountry'),
            tooltip: '修改国家 / 地区',
            icon: _busy
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.edit_outlined, size: 18),
            onPressed: _busy ? null : _edit,
          ),
        ]),
      ]),
    );
  }
}
