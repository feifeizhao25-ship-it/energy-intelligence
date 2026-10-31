import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../theme/app_theme.dart';

/// Shows the account's plan and real usage (GET /api/v1/billing/usage). Nothing here is a placeholder:
/// the numbers, plan name and feature list all come from the server, and a failed load says so.
typedef UsageLoader = Future<Map<String, dynamic>> Function();

class PlanUsageScreen extends StatefulWidget {
  final UsageLoader? loader;
  const PlanUsageScreen({super.key, this.loader});

  @override
  State<PlanUsageScreen> createState() => _PlanUsageScreenState();
}

enum _Phase { loading, failed, ready }

class _PlanUsageScreenState extends State<PlanUsageScreen> {
  _Phase _phase = _Phase.loading;
  Map<String, dynamic> _data = const {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _phase = _Phase.loading);
    try {
      final data = await (widget.loader ?? ApiService.getUsage)();
      if (!mounted) return;
      setState(() {
        _data = data;
        _phase = _Phase.ready;
      });
    } catch (_) {
      if (mounted) setState(() => _phase = _Phase.failed);
    }
  }

  String _label(String category) {
    switch (category) {
      case 'ai_queries':
        return 'AI 提问（每日）';
      case 'report_exports':
        return '报告导出（每月）';
      case 'projects':
        return '项目数量';
    }
    return category;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('会员权益与用量')),
      body: SafeArea(child: _body(context)),
    );
  }

  Widget _body(BuildContext context) {
    switch (_phase) {
      case _Phase.loading:
        return const Center(key: Key('planUsageLoading'), child: CircularProgressIndicator());
      case _Phase.failed:
        return Center(
          key: const Key('planUsageError'),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.cloud_off, size: 40, color: Theme.of(context).colorScheme.outline),
              const SizedBox(height: 12),
              const Text('暂时无法获取用量，请检查网络后重试', textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton(onPressed: _load, child: const Text('重试')),
            ]),
          ),
        );
      case _Phase.ready:
        return _ready(context);
    }
  }

  Widget _ready(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final items = [for (final i in (_data['items'] as List? ?? const [])) Map<String, dynamic>.from(i as Map)];
    final features = [for (final f in (_data['plan_features'] as List? ?? const [])) '$f'];
    final resets = Map<String, dynamic>.from((_data['resets'] as Map?) ?? const {});
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Semantics(
            container: true,
            label: '会员权益与用量: ${_data['plan_name'] ?? ''}',
            child: Container(
              key: const Key('planCard'),
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: [AppTheme.primaryColor, AppTheme.primaryColor.withValues(alpha: 0.78)]),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('当前套餐与已用额度', style: TextStyle(color: Colors.white70, fontSize: 12)),
                const SizedBox(height: 6),
                Text('${_data['plan_name'] ?? ''}',
                    key: const Key('planName'),
                    style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)),
                if (features.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Text('套餐包含', style: TextStyle(color: Colors.white70, fontSize: 12)),
                  const SizedBox(height: 4),
                  for (final f in features)
                    Padding(
                      padding: const EdgeInsets.only(top: 3),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Icon(Icons.check_circle_outline, size: 16, color: Colors.white),
                        const SizedBox(width: 8),
                        Expanded(child: Text(f, style: const TextStyle(color: Colors.white, fontSize: 13, height: 1.35))),
                      ]),
                    ),
                ],
              ]),
            ),
          ),
          const SizedBox(height: 20),
          Text('已用额度', style: Theme.of(context).textTheme.titleSmall?.copyWith(color: scheme.onSurfaceVariant)),
          const SizedBox(height: 8),
          for (final item in items) _usageCard(context, item, resets),
          const SizedBox(height: 8),
          Text('如需调整套餐，请在网页端的会员页面操作。', style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant, height: 1.4)),
        ],
      ),
    );
  }

  Widget _usageCard(BuildContext context, Map<String, dynamic> item, Map<String, dynamic> resets) {
    final scheme = Theme.of(context).colorScheme;
    final category = '${item['category']}';
    final used = (item['used'] as num?)?.toInt() ?? 0;
    final limit = (item['limit'] as num?)?.toInt() ?? 0;
    final unlimited = limit == -1;
    final ratio = unlimited ? 0.0 : ((item['usage_ratio'] as num?)?.toDouble() ?? 0.0).clamp(0.0, 1.0);
    final level = '${item['warning_level']}';
    final color = level == 'blocked' || level == 'critical'
        ? scheme.error
        : level == 'warning'
            ? AppTheme.warningColor
            : AppTheme.primaryColor;
    final period = '${item['period']}';
    final resetText = period == 'day'
        ? '明天重置（UTC 日期 {date}）'.replaceAll('{date}', '${resets['day'] ?? ''}')
        : period == 'month'
            ? '下月 1 日重置（UTC 日期 {date}）'.replaceAll('{date}', '${resets['month'] ?? ''}')
            : '按当前数量统计，不会自动重置';
    final levelText = level == 'blocked'
        ? '已用完'
        : level == 'critical'
            ? '几乎用完'
            : level == 'warning'
                ? '已用 80% 以上'
                : null;
    final summary = unlimited ? '$used 已用 · 不限' : '$used / $limit';
    return Semantics(
      container: true,
      label: '${_label(category)}: $summary${levelText == null ? '' : ', $levelText'}',
      child: Card(
        key: Key('usageItem_$category'),
        margin: const EdgeInsets.only(bottom: 10),
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: scheme.outlineVariant),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(_label(category), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14))),
              Text(summary, style: TextStyle(fontWeight: FontWeight.w700, color: color)),
            ]),
            if (!unlimited) ...[
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: LinearProgressIndicator(value: ratio, minHeight: 8, color: color, backgroundColor: color.withValues(alpha: 0.12)),
              ),
            ],
            const SizedBox(height: 8),
            Row(children: [
              if (levelText != null) ...[
                Icon(Icons.info_outline, size: 14, color: color),
                const SizedBox(width: 4),
                Text(levelText, style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600)),
                const SizedBox(width: 8),
              ],
              Expanded(child: Text(resetText, style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant))),
            ]),
          ]),
        ),
      ),
    );
  }
}
