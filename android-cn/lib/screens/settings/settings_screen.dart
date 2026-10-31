import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/photo_widgets.dart';
import '../library/energy_library.dart';
import 'plan_usage_screen.dart';

/// Account screen. Every row does what it says: the profile is read from the server, export fetches the real
/// data copy, delete calls the account-deletion API and signing out clears the stored token.
class SettingsScreen extends StatefulWidget {
  final Future<Map<String, dynamic>> Function()? meLoader;
  final Future<Map<String, dynamic>> Function()? exporter;
  final Future<void> Function()? deleter;
  final Future<void> Function()? signOut;
  final UsageLoader? usageLoader;

  const SettingsScreen({super.key, this.meLoader, this.exporter, this.deleter, this.signOut, this.usageLoader});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  String? _account;
  String? _detail;

  @override
  void initState() {
    super.initState();
    _loadAccount();
  }

  Future<void> _loadAccount() async {
    try {
      final me = await (widget.meLoader ?? ApiService.getMe)();
      final name = me['name'] ?? me['full_name'];
      final contact = me['email'] ?? me['phone'];
      final primary = (name != null && '$name'.isNotEmpty) ? '$name' : (contact != null ? '$contact' : null);
      if (mounted && primary != null && primary.isNotEmpty) {
        setState(() {
          _account = primary;
          _detail = (contact != null && '$contact' != primary) ? '$contact' : null;
        });
      }
    } catch (_) {
      // Keep the neutral "signed in" label; never show invented personal details.
    }
  }

  void _snack(String text) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  Future<void> _export() async {
    try {
      final data = await (widget.exporter ?? ApiService.exportMyData)();
      if (!mounted) return;
      final counts = <String, int>{
        for (final e in data.entries)
          if (e.value is List) e.key: (e.value as List).length,
      };
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('你的数据副本'),
          content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('已生成数据副本，包含下列记录数。点“复制”后可粘贴保存。'),
            const SizedBox(height: 10),
            for (final e in counts.entries) Text('${e.key}: ${e.value}', style: const TextStyle(fontSize: 12)),
          ]),
          actions: [
            TextButton(
              key: const Key('exportCopy'),
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: const JsonEncoder.withIndent('  ').convert(data)));
                if (dialogContext.mounted) Navigator.pop(dialogContext);
                if (mounted) _snack('已复制到剪贴板');
              },
              child: const Text('复制'),
            ),
            TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('关闭')),
          ],
        ),
      );
    } catch (_) {
      if (mounted) _snack('导出失败，请稍后重试');
    }
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(context: context, builder: (_) => const _DeleteConfirmDialog());
    if (confirmed != true || !mounted) return;
    try {
      await (widget.deleter ?? ApiService.deleteMyAccount)();
      await (widget.signOut ?? ApiService.logout)();
      if (!mounted) return;
      Navigator.of(context).pushNamedAndRemoveUntil('/login', (_) => false);
    } catch (_) {
      if (mounted) _snack('删除失败，请稍后重试');
    }
  }

  Future<void> _confirmSignOut() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('退出登录'),
        content: const Text('确定要退出登录吗？'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('取消')),
          TextButton(key: const Key('signOutConfirm'), onPressed: () => Navigator.pop(dialogContext, true), child: const Text('确定')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    await (widget.signOut ?? ApiService.logout)();
    if (!mounted) return;
    Navigator.of(context).pushNamedAndRemoveUntil('/login', (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('设置')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.only(bottom: 32),
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: EnBanner(
                asset: 'assets/images/en_settings_blade.webp',
                caption: '我的账号',
                chips: [(Icons.workspace_premium_outlined, '套餐'), (Icons.lock_outline, '数据与隐私')],
                height: 130,
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Row(children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: AppTheme.primaryColor.withValues(alpha: 0.14),
                  child: Icon(Icons.person_outline, color: scheme.primary, size: 30),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(_account ?? '已登录账号', key: const Key('accountName'), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                    if (_detail != null) Text(_detail!, style: TextStyle(fontSize: 13, color: scheme.onSurfaceVariant)),
                  ]),
                ),
              ]),
            ),
            _tile(Icons.workspace_premium_outlined, '会员权益与用量', '查看套餐、已用额度和重置时间', const Key('openPlanUsage'), () {
              Navigator.of(context).push(MaterialPageRoute(builder: (_) => PlanUsageScreen(loader: widget.usageLoader)));
            }),
            _header('数据与隐私'),
            _tile(Icons.download_outlined, '导出我的数据', '获取你在本应用中的全部数据副本', const Key('exportData'), _export),
            _tile(Icons.delete_forever_outlined, '删除账号', '永久删除账号及全部数据', const Key('deleteAccount'), _delete, danger: true),
            const EnergyLibraryEntry(),
            const Divider(height: 28),
            _tile(Icons.info_outline, '关于', null, const Key('about'), () {
              showAboutDialog(context: context, applicationName: '新能源智库', applicationLegalese: '测算结果依赖输入参数与数据来源，仅供参考，不构成投资或工程决策依据。');
            }),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: OutlinedButton.icon(
                key: const Key('signOut'),
                onPressed: _confirmSignOut,
                icon: const Icon(Icons.logout),
                label: const Text('退出登录'),
                style: OutlinedButton.styleFrom(foregroundColor: scheme.error, side: BorderSide(color: scheme.error), minimumSize: const Size.fromHeight(46)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _header(String text) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
        child: Semantics(header: true, child: Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Theme.of(context).colorScheme.onSurfaceVariant))),
      );

  Widget _tile(IconData icon, String title, String? subtitle, Key key, VoidCallback onTap, {bool danger = false}) {
    final scheme = Theme.of(context).colorScheme;
    final color = danger ? scheme.error : null;
    return ListTile(
      key: key,
      leading: Icon(icon, color: color ?? scheme.onSurfaceVariant),
      title: Text(title, style: TextStyle(fontSize: 15, color: color)),
      subtitle: subtitle == null ? null : Text(subtitle, style: const TextStyle(fontSize: 12)),
      trailing: Icon(Icons.chevron_right, color: scheme.outline),
      onTap: onTap,
    );
  }
}

/// Asks the person to type DELETE; owns its controller so it is disposed together with the dialog.
class _DeleteConfirmDialog extends StatefulWidget {
  const _DeleteConfirmDialog();

  @override
  State<_DeleteConfirmDialog> createState() => _DeleteConfirmDialogState();
}

class _DeleteConfirmDialogState extends State<_DeleteConfirmDialog> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ready = _controller.text.trim() == 'DELETE';
    return AlertDialog(
      title: const Text('删除账号'),
      content: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('将立即删除你的项目、模型和报告，且无法恢复。依法需保留的支付记录会与你的身份解除关联。输入 DELETE 以确认。'),
          const SizedBox(height: 12),
          TextField(
            key: const Key('deleteConfirmField'),
            controller: _controller,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(hintText: '输入 DELETE', border: OutlineInputBorder()),
          ),
        ]),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('取消')),
        TextButton(
          key: const Key('deleteConfirmButton'),
          onPressed: ready ? () => Navigator.pop(context, true) : null,
          child: Text('删除', style: TextStyle(color: ready ? Colors.red : null)),
        ),
      ],
    );
  }
}
