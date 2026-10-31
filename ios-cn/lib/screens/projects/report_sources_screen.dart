import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../widgets/photo_widgets.dart';

/// Lets the user register the sources a project's reports cite (GET/PUT /api/v1/finance/data-sources/{id}).
/// A report only ever cites what is registered here; the screen never invents or pre-fills a source.
typedef ReportSourcesLoader = Future<Map<String, dynamic>> Function(String projectId);
typedef ReportSourcesSaver = Future<Map<String, dynamic>> Function(String projectId, List<Map<String, String>> sources);

class ReportSourcesScreen extends StatefulWidget {
  final String projectId;
  final String projectName;
  final ReportSourcesLoader? loader;
  final ReportSourcesSaver? saver;

  const ReportSourcesScreen({
    super.key,
    required this.projectId,
    required this.projectName,
    this.loader,
    this.saver,
  });

  @override
  State<ReportSourcesScreen> createState() => _ReportSourcesScreenState();
}

enum _Phase { loading, failed, noModel, ready }

class _ReportSourcesScreenState extends State<ReportSourcesScreen> {
  _Phase _phase = _Phase.loading;
  List<Map<String, String>> _sources = [];
  bool _dirty = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _phase = _Phase.loading);
    try {
      final load = widget.loader ?? ApiService.getReportSources;
      final data = await load(widget.projectId);
      if (!mounted) return;
      if (data['has_financial_model'] == false) {
        setState(() => _phase = _Phase.noModel);
        return;
      }
      final raw = (data['sources'] as List?) ?? const [];
      setState(() {
        _sources = [
          for (final s in raw)
            {
              for (final e in Map<String, dynamic>.from(s as Map).entries)
                if (e.value != null && e.value.toString().isNotEmpty) e.key: e.value.toString(),
            },
        ];
        _dirty = false;
        _phase = _Phase.ready;
      });
    } catch (_) {
      if (mounted) setState(() => _phase = _Phase.failed);
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final save = widget.saver ?? ApiService.putReportSources;
      await save(widget.projectId, _sources);
      if (!mounted) return;
      setState(() {
        _dirty = false;
        _saving = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('已保存')));
    } catch (_) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('保存失败，请稍后重试')));
    }
  }

  Future<void> _add() async {
    final added = await showModalBottomSheet<Map<String, String>>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _AddSourceSheet(),
    );
    if (added == null) return;
    setState(() {
      _sources = [..._sources, added];
      _dirty = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('报告数据来源')),
      body: SafeArea(child: _body(context)),
      bottomNavigationBar: _phase == _Phase.ready
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: Row(children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      key: const Key('addSource'),
                      onPressed: _saving ? null : _add,
                      icon: const Icon(Icons.add),
                      label: const Text('添加来源'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      key: const Key('saveSources'),
                      onPressed: (_dirty && !_saving) ? _save : null,
                      child: _saving
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Text('保存'),
                    ),
                  ),
                ]),
              ),
            )
          : null,
    );
  }

  Widget _body(BuildContext context) {
    switch (_phase) {
      case _Phase.loading:
        return const Center(child: CircularProgressIndicator(key: Key('sourcesLoading')));
      case _Phase.failed:
        return _Message(
          key: const Key('sourcesError'),
          icon: Icons.cloud_off,
          title: '加载失败，请检查网络后重试',
          action: FilledButton(onPressed: _load, child: const Text('重试')),
        );
      case _Phase.noModel:
        return const _Message(
          key: Key('sourcesNoModel'),
          icon: Icons.calculate_outlined,
          title: '还没有财务模型',
          body: '请先在“收益计算”中为该项目保存财务模型，再回来登记数据来源。',
        );
      case _Phase.ready:
        final theme = Theme.of(context);
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            EnBanner(
              asset: 'assets/images/en_sources_desk.webp',
              caption: widget.projectName,
              chips: const [(Icons.fact_check_outlined, '报告只引用你登记的来源')],
              height: 150,
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: theme.colorScheme.primary.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text('报告只会引用你在这里登记的来源，不会自行编造。每条来源需要标题和链接，生成报告前请确认链接内容真实可打开。', style: theme.textTheme.bodySmall),
            ),
            const SizedBox(height: 12),
            if (_sources.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 12),
                child: EnEmptyState(
                  key: Key('sourcesEmpty'),
                  asset: 'assets/images/eg_empty.webp',
                  title: '还没有登记来源',
                  message: '添加政策文件、电价通知或数据报告的链接，报告才能通过来源核验。',
                ),
              )
            else ...[
              Text('已登记 ${_sources.length} 条', key: const Key('sourcesCount'), style: theme.textTheme.labelMedium),
              const SizedBox(height: 8),
              for (var i = 0; i < _sources.length; i++) _sourceCard(context, i),
            ],
          ],
        );
    }
  }

  Widget _sourceCard(BuildContext context, int i) {
    final s = _sources[i];
    final meta = [if (s['publisher'] != null) s['publisher']!, if (s['published_at'] != null) s['published_at']!].join(' · ');
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Theme.of(context).dividerColor),
      ),
      child: ListTile(
        title: Text(s['title'] ?? '', maxLines: 2, overflow: TextOverflow.ellipsis),
        subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (meta.isNotEmpty) Text(meta),
          Text(s['url'] ?? '无链接', maxLines: 1, overflow: TextOverflow.ellipsis),
        ]),
        trailing: IconButton(
          key: Key('removeSource$i'),
          tooltip: '删除',
          icon: const Icon(Icons.delete_outline),
          onPressed: _saving
              ? null
              : () => setState(() {
                    _sources = [..._sources]..removeAt(i);
                    _dirty = true;
                  }),
        ),
      ),
    );
  }
}

class _Message extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? body;
  final Widget? action;
  const _Message({super.key, required this.icon, required this.title, this.body, this.action});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 40, color: theme.colorScheme.outline),
          const SizedBox(height: 12),
          Text(title, textAlign: TextAlign.center, style: theme.textTheme.titleSmall),
          if (body != null) ...[
            const SizedBox(height: 6),
            Text(body!, textAlign: TextAlign.center, style: theme.textTheme.bodySmall),
          ],
          if (action != null) ...[const SizedBox(height: 16), action!],
        ]),
      ),
    );
  }
}

class _AddSourceSheet extends StatefulWidget {
  const _AddSourceSheet();

  @override
  State<_AddSourceSheet> createState() => _AddSourceSheetState();
}

class _AddSourceSheetState extends State<_AddSourceSheet> {
  final _title = TextEditingController();
  final _link = TextEditingController();
  final _publisher = TextEditingController();
  final _date = TextEditingController();
  String? _titleError;
  String? _linkError;

  @override
  void dispose() {
    _title.dispose();
    _link.dispose();
    _publisher.dispose();
    _date.dispose();
    super.dispose();
  }

  void _submit() {
    final title = _title.text.trim();
    final link = _link.text.trim();
    final okLink = RegExp(r'^https?://\S+$', caseSensitive: false).hasMatch(link);
    setState(() {
      _titleError = title.isEmpty ? '请填写标题' : null;
      _linkError = okLink ? null : '请填写以 http:// 或 https:// 开头的链接';
    });
    if (title.isEmpty || !okLink) return;
    Navigator.of(context).pop(<String, String>{
      'title': title,
      'url': link,
      if (_publisher.text.trim().isNotEmpty) 'publisher': _publisher.text.trim(),
      if (_date.text.trim().isNotEmpty) 'published_at': _date.text.trim(),
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('添加来源', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          TextField(
            key: const Key('fieldTitle'),
            controller: _title,
            maxLength: 200,
            decoration: InputDecoration(labelText: '标题（必填）', errorText: _titleError),
          ),
          TextField(
            key: const Key('fieldLink'),
            controller: _link,
            keyboardType: TextInputType.url,
            decoration: InputDecoration(labelText: '链接（需以 http:// 或 https:// 开头）', errorText: _linkError),
          ),
          TextField(
            key: const Key('fieldPublisher'),
            controller: _publisher,
            decoration: const InputDecoration(labelText: '发布机构（选填）'),
          ),
          TextField(
            key: const Key('fieldDate'),
            controller: _date,
            decoration: const InputDecoration(labelText: '发布日期（选填，如 2026-09-01）'),
          ),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(child: OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('取消'))),
            const SizedBox(width: 12),
            Expanded(child: FilledButton(key: const Key('confirmAdd'), onPressed: _submit, child: const Text('确定'))),
          ]),
        ]),
      ),
    );
  }
}
